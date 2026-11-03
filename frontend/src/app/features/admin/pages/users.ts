import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';

import { Toast } from '../../../core/toast';
import { AdminApi, apiError } from '../core/admin-api';
import { AdminAuth, AdminUser } from '../core/admin-auth';

interface UserForm { id: number | null; email: string; full_name: string; password: string; role: 'admin' | 'super_admin'; is_active: boolean }
const MIN_PASSWORD = 8;

@Component({
  selector: 'app-admin-users',
  imports: [DatePipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-5 flex items-center justify-between">
      <h1 class="text-2xl font-bold">Admin users</h1>
      <button type="button" class="btn-primary" (click)="form.set({ id: null, email: '', full_name: '', password: '', role: 'admin', is_active: true })">+ New admin</button>
    </div>
    <div class="grid gap-6 xl:grid-cols-[1fr_24rem]">
      <div class="overflow-x-auto rounded-lg border bg-white">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-left"><tr><th class="px-3 py-2">Email</th><th class="px-3 py-2">Name</th><th class="px-3 py-2">Role</th><th class="px-3 py-2">Active</th><th class="px-3 py-2">Last login</th><th></th></tr></thead>
          <tbody>
            @for (u of users.value(); track u.id) {
              <tr class="border-t">
                <td class="px-3 py-2">{{ u.email }}</td><td class="px-3 py-2">{{ u.full_name }}</td>
                <td class="px-3 py-2">{{ u.role === 'super_admin' ? 'Super admin' : 'Admin' }}</td>
                <td class="px-3 py-2">{{ u.is_active ? 'Yes' : 'No' }}</td>
                <td class="px-3 py-2 text-gray-500">{{ u.last_login_at | date: 'short' }}</td>
                <td class="space-x-3 px-3 py-2 text-right">
                  <button type="button" class="text-brand hover:underline" (click)="form.set({ id: u.id, email: u.email, full_name: u.full_name, password: '', role: u.role, is_active: u.is_active })">Edit</button>
                  @if (u.id !== auth.user()?.id) { <button type="button" class="text-red-600 hover:underline" (click)="remove(u)">Delete</button> }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (form(); as f) {
        <form class="card h-fit space-y-3 p-5" (submit)="save($event)">
          <h2 class="font-semibold">{{ f.id ? 'Edit admin' : 'New admin' }}</h2>
          <div><label class="label" for="u-email">Email</label><input id="u-email" name="email" type="email" class="input" [disabled]="!!f.id" [(ngModel)]="f.email" /></div>
          <div><label class="label" for="u-name">Full name</label><input id="u-name" name="full_name" class="input" [(ngModel)]="f.full_name" /></div>
          <div><label class="label" for="u-pass">{{ f.id ? 'New password (optional)' : 'Password' }}</label>
            <input id="u-pass" name="password" type="password" autocomplete="new-password" class="input" [(ngModel)]="f.password" />
            <p class="mt-1 text-xs text-gray-500">At least {{ minPassword }} characters.</p></div>
          <div><label class="label" for="u-role">Role</label><select id="u-role" name="role" class="input" [(ngModel)]="f.role">
            <option value="admin">Admin</option><option value="super_admin">Super admin</option></select></div>
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" [(ngModel)]="f.is_active" /> Active</label>
          @if (error()) { <p class="rounded bg-red-50 p-2 text-sm text-red-700" role="alert">{{ error() }}</p> }
          <div class="flex gap-2"><button type="submit" class="btn-primary">Save</button><button type="button" class="btn-outline" (click)="form.set(null)">Cancel</button></div>
        </form>
      }
    </div>
  `,
})
export class AdminUsers {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(Toast);
  protected readonly auth = inject(AdminAuth);
  protected readonly minPassword = MIN_PASSWORD;
  protected readonly users = rxResource({ stream: () => this.api.all<AdminUser>('users') });
  protected readonly form = signal<UserForm | null>(null);
  protected readonly error = signal<string | null>(null);

  protected save(event: Event): void {
    event.preventDefault();
    const f = this.form();
    if (!f) return;
    if ((!f.id || f.password) && f.password.length < MIN_PASSWORD) {
      this.error.set(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    const body = f.id
      ? { full_name: f.full_name, role: f.role, is_active: f.is_active, ...(f.password ? { password: f.password } : {}) }
      : { email: f.email, full_name: f.full_name, password: f.password, role: f.role, is_active: f.is_active };
    const req = f.id ? this.api.update('users', f.id, body) : this.api.create('users', body);
    req.subscribe({
      next: () => {
        this.toast.show('Admin saved');
        this.form.set(null);
        this.error.set(null);
        this.users.reload();
      },
      error: (e: unknown) => this.error.set(apiError(e, 'Could not save')),
    });
  }

  protected remove(u: AdminUser): void {
    if (!confirm(`Delete ${u.email}?`)) return;
    this.api.remove('users', u.id).subscribe({ next: () => this.users.reload(), error: (e: unknown) => this.toast.error(apiError(e)) });
  }
}

@Component({
  selector: 'app-admin-account',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-5 text-2xl font-bold">My account</h1>
    <p class="mb-4 text-sm text-gray-600">Signed in as <strong>{{ auth.user()?.email }}</strong></p>
    <form class="card max-w-md space-y-3 p-5" (submit)="save($event)">
      <h2 class="font-semibold">Change password</h2>
      <div><label class="label" for="a-cur">Current password</label><input id="a-cur" name="current" type="password" autocomplete="current-password" class="input" [(ngModel)]="current" /></div>
      <div><label class="label" for="a-new">New password</label><input id="a-new" name="next" type="password" autocomplete="new-password" class="input" [(ngModel)]="next" /></div>
      @if (error()) { <p class="rounded bg-red-50 p-2 text-sm text-red-700" role="alert">{{ error() }}</p> }
      <button type="submit" class="btn-primary">Update password</button>
      <p class="text-xs text-gray-500">You will be signed out everywhere and asked to sign in again.</p>
    </form>
  `,
})
export class AdminAccount {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(Toast);
  protected readonly auth = inject(AdminAuth);
  protected current = '';
  protected next = '';
  protected readonly error = signal<string | null>(null);

  protected save(event: Event): void {
    event.preventDefault();
    if (this.next.length < MIN_PASSWORD) {
      this.error.set(`New password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    this.api.changePassword(this.current, this.next).subscribe({
      next: (r) => {
        this.toast.show(r.detail);
        void this.auth.logout();
      },
      error: (e: unknown) => this.error.set(apiError(e, 'Could not change password')),
    });
  }
}
