import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Toast } from '../../../core/toast';
import { Icon } from '../../../shared/ui/icon';
import { FormActions } from '../ui/form-actions';
import { PageHeader } from '../ui/page-header';
import { AdminApi, apiError } from '../core/admin-api';
import { AdminAuth } from '../core/admin-auth';

const MIN_PASSWORD = 8;

@Component({
  selector: 'app-admin-account',
  imports: [FormsModule, Icon, PageHeader, FormActions],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="My account" [subtitle]="'Signed in as ' + (auth.user()?.email ?? '')" />
    <form class="card w-full max-w-md space-y-4 p-4 sm:p-5" (submit)="save($event)">
      <h2 class="font-semibold text-gray-900">Change password</h2>
      <div>
        <label class="label" for="a-cur">Current password</label>
        <input id="a-cur" name="current" type="password" autocomplete="current-password" class="input" [(ngModel)]="current" required />
      </div>
      <div>
        <label class="label" for="a-new">New password</label>
        <div class="relative">
          <input id="a-new" name="next" [type]="show() ? 'text' : 'password'" autocomplete="new-password" class="input !pr-12" [(ngModel)]="next" required />
          <button type="button" class="icon-btn absolute right-0 top-0 h-11 w-11" (click)="show.set(!show())"
                  [attr.aria-label]="show() ? 'Hide password' : 'Show password'">
            <app-icon [name]="show() ? 'eyeOff' : 'eye'" [size]="16" />
          </button>
        </div>
        <p class="mt-1 text-xs text-gray-500">At least {{ minPassword }} characters.</p>
      </div>
      @if (error()) { <p class="rounded bg-red-50 p-2 text-sm text-red-700" role="alert">{{ error() }}</p> }
      <app-form-actions>
        <button type="submit" class="btn-primary" [disabled]="saving()">
          @if (saving()) { Updating… } @else { Update password }
        </button>
      </app-form-actions>
      <p class="text-xs text-gray-500">You will be signed out everywhere and asked to sign in again.</p>
    </form>
  `,
})
export class AdminAccount {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(Toast);
  protected readonly auth = inject(AdminAuth);
  protected readonly minPassword = MIN_PASSWORD;
  protected readonly show = signal(false);
  protected readonly saving = signal(false);
  protected current = '';
  protected next = '';
  protected readonly error = signal<string | null>(null);

  protected save(event: Event): void {
    event.preventDefault();
    if (this.saving()) return;
    if (this.next.length < MIN_PASSWORD) {
      this.error.set(`New password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    this.saving.set(true);
    this.api.changePassword(this.current, this.next).subscribe({
      next: (r) => {
        this.toast.show(r.detail);
        void this.auth.logout();
      },
      error: (e: unknown) => {
        this.error.set(apiError(e, 'Could not change password'));
        this.saving.set(false);
      },
    });
  }
}
