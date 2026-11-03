import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { Seo } from '../../../core/seo';
import { apiError } from '../core/admin-api';
import { AdminAuth } from '../core/admin-auth';

@Component({
  selector: 'app-admin-login',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <form class="card w-full max-w-sm space-y-4 p-6 shadow" (submit)="submit($event)">
        <h1 class="text-xl font-bold">Admin sign in</h1>
        @if (expired) { <p class="rounded bg-amber-50 p-2 text-sm text-amber-800">Your session expired. Please sign in again.</p> }
        <div><label class="label" for="email">Email</label>
          <input id="email" name="email" type="email" autocomplete="username" class="input" required [(ngModel)]="email" /></div>
        <div><label class="label" for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" class="input" required [(ngModel)]="password" /></div>
        @if (error()) { <p class="rounded bg-red-50 p-2 text-sm text-red-700" role="alert">{{ error() }}</p> }
        <button type="submit" class="btn-primary w-full" [disabled]="busy()">{{ busy() ? 'Signing in…' : 'Sign in' }}</button>
      </form>
    </div>
  `,
})
export class AdminLogin {
  private readonly auth = inject(AdminAuth);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected email = '';
  protected password = '';
  protected readonly busy = signal(false);
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
