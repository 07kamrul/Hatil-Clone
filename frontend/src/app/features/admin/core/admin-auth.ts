import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, finalize, firstValueFrom, map, shareReplay, tap } from 'rxjs';

import { BrowserStorage } from '../../../core/browser-storage';
import { API_BASE } from '../../../core/config';

const TOKENS_KEY = 'admin.tokens.v1';

export interface TokenPair { access_token: string; refresh_token: string; token_type: string; expires_in: number }
export interface AdminUser { id: number; email: string; full_name: string; role: 'super_admin' | 'admin'; is_active: boolean; last_login_at: string | null; created_at: string }

/**
 * Admin session. Tokens live in localStorage (admin-only app, CSP-protected, short-lived access token);
 * refresh tokens rotate on every use and reuse is detected server-side.
 */
@Injectable({ providedIn: 'root' })
export class AdminAuth {
  private readonly storage = inject(BrowserStorage);
  private readonly router = inject(Router);
  private readonly base = inject(API_BASE);
  /** Bypasses interceptors so auth calls never recurse into refresh logic. */
  private readonly http = new HttpClient(inject(HttpBackend));

  private readonly tokens = signal<TokenPair | null>(this.storage.get<TokenPair | null>(TOKENS_KEY, null));
  private readonly userState = signal<AdminUser | null>(null);
  private refreshing$: Observable<string> | null = null;

  readonly user = this.userState.asReadonly();
  readonly isLoggedIn = computed(() => !!this.tokens());
  readonly isSuperAdmin = computed(() => this.userState()?.role === 'super_admin');

  accessToken(): string | null {
    return this.tokens()?.access_token ?? null;
  }

  async login(email: string, password: string): Promise<void> {
    const pair = await firstValueFrom(this.http.post<TokenPair>(`${this.base}/auth/login`, { email, password }));
    this.store(pair);
    await this.loadUser();
  }

  async loadUser(): Promise<AdminUser | null> {
    const token = this.accessToken();
    if (!token) return null;
    try {
      const user = await firstValueFrom(this.http.get<AdminUser>(`${this.base}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }));
      this.userState.set(user);
      return user;
    } catch {
      try {
        await firstValueFrom(this.refresh());
        return this.loadUser();
      } catch {
        this.clear();
        return null;
      }
    }
  }

  /** Single in-flight refresh shared by all concurrent 401s. Emits the new access token. */
  refresh(): Observable<string> {
    const refreshToken = this.tokens()?.refresh_token;
    if (!refreshToken) throw new Error('No refresh token');
    this.refreshing$ ??= this.http.post<TokenPair>(`${this.base}/auth/refresh`, { refresh_token: refreshToken }).pipe(
      tap((pair) => this.store(pair)),
      map((pair) => pair.access_token),
      finalize(() => (this.refreshing$ = null)),
      shareReplay(1),
    );
    return this.refreshing$;
  }

  async logout(): Promise<void> {
    const refreshToken = this.tokens()?.refresh_token;
    if (refreshToken) {
      await firstValueFrom(this.http.post(`${this.base}/auth/logout`, { refresh_token: refreshToken })).catch(() => undefined);
    }
    this.clear();
    await this.router.navigate(['/admin/login']);
  }

  expire(): void {
    this.clear();
    void this.router.navigate(['/admin/login'], { queryParams: { expired: 1 } });
  }

  private store(pair: TokenPair): void {
    this.tokens.set(pair);
    this.storage.set(TOKENS_KEY, pair);
  }

  private clear(): void {
    this.tokens.set(null);
    this.userState.set(null);
    this.storage.set(TOKENS_KEY, null);
  }
}
