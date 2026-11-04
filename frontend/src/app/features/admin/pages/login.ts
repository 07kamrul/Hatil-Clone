import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { Seo } from '../../../core/seo';
import { apiError } from '../core/admin-api';
import { AdminAuth } from '../core/admin-auth';
import { Icon } from '../../../shared/ui/icon';

@Component({
  selector: 'app-admin-login',
  imports: [FormsModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="flex min-h-dvh items-center justify-center bg-gray-100 px-4 py-10">
      <form class="card w-full max-w-sm space-y-5 p-6 shadow-soft sm:max-w-md sm:p-8" (submit)="submit($event)">
        <div class="space-y-1 text-center">
          <span class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-white"><app-icon name="shield" [size]="22" /></span>
          <h1 class="text-xl font-bold text-gray-900 sm:text-2xl">Admin sign in</h1>
          <p class="text-muted">Sign in to manage the catalogue.</p>
        </div>
        @if (expired) {
          <p class="rounded bg-amber-50 p-2 text-sm text-amber-800">
            Your session expired. Please sign in again.
          </p>
        }
        <div>
          <label class="label" for="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autocomplete="username"
            class="input"
            required
            [(ngModel)]="email"
          />
        </div>
        <div>
          <label class="label" for="password">Password</label>
          <div class="relative">
          <input
            id="password"
            name="password"
            [type]="showPassword() ? 'text' : 'password'"
            autocomplete="current-password"
            class="input !pr-12"
            required
            [(ngModel)]="password"
          />
          <button
            type="button"
            class="absolute right-0 top-0 inline-flex h-11 w-11 items-center justify-center rounded-md text-gray-500 hover:text-gray-800 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
            (click)="showPassword.set(!showPassword())"
            [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
            [attr.aria-pressed]="showPassword()"
          >
            <app-icon [name]="showPassword() ? 'eyeOff' : 'eye'" [size]="18" />
          </button>
          </div>
        </div>
        @if (error()) {
          <p class="rounded bg-red-50 p-2 text-sm text-red-700" role="alert">{{ error() }}</p>
        }
        <button type="submit" class="btn-primary w-full" [disabled]="busy()">
          {{ busy() ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
    </main>
  `,
})
export class AdminLogin {
  private readonly auth = inject(AdminAuth);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected email = '';
  protected password = '';
  protected readonly busy = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly expired = this.route.snapshot.queryParamMap.has('expired');

  constructor() {
    inject(Seo).set({ title: 'Admin sign in', noindex: true });
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.email || !this.password) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.login(this.email.trim(), this.password);
      const next = this.route.snapshot.queryParamMap.get('next');
      // Only follow same-app admin paths to avoid open redirects.
      await this.router.navigateByUrl(next && next.startsWith('/admin') ? next : '/admin');
    } catch (err: unknown) {
      this.error.set(apiError(err, 'Sign in failed'));
    } finally {
      this.busy.set(false);
    }
  }
}
