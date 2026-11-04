import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';

import { Toast } from '../../../core/toast';
import { Icon } from '../../../shared/ui/icon';
import { AdminApi, apiError } from '../core/admin-api';
import { AdminAuth, AdminUser } from '../core/admin-auth';
import { Badge } from '../ui/badge';
import { PageHeader } from '../ui/page-header';
import { SidePanel } from '../ui/side-panel';
import { ConfirmService } from '../ui/confirm-dialog';

interface UserForm { id: number | null; email: string; full_name: string; password: string; role: 'admin' | 'super_admin'; is_active: boolean }
const MIN_PASSWORD = 8;

export function passwordError(password: string, isEdit: boolean): string | null {
  if (isEdit && !password) return null;
  if (password.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters.`;
  return null;
}

export function filterUsers(users: AdminUser[], q: string, role: string, status: string): AdminUser[] {
  const needle = q.trim().toLowerCase();
  return users.filter((u) => {
    if (needle && !u.email.toLowerCase().includes(needle) && !u.full_name.toLowerCase().includes(needle)) return false;
    if (role !== 'all' && u.role !== role) return false;
    if (status !== 'all' && (status === 'active') !== u.is_active) return false;
    return true;
  });
}

export function initials(nameOrEmail: string): string {
  const parts = nameOrEmail.trim().split(/[\s@._-]+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('') || '?';
}

@Component({
  selector: 'app-admin-users',
  imports: [DatePipe, FormsModule, Icon, Badge, PageHeader, SidePanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Admin users" [subtitle]="subtitle()">
      <button actions type="button" class="btn-primary" (click)="newUser()">
        <app-icon name="plus" [size]="16" /> New admin
      </button>
    </app-page-header>

    <div class="mb-4 flex flex-wrap items-center gap-2">
      <input type="search" class="input max-w-full sm:max-w-xs" placeholder="Search email or name…" [ngModel]="q()" (ngModelChange)="q.set($event)" aria-label="Search admins" />
      <select class="input w-auto" [ngModel]="role()" (ngModelChange)="role.set($event)" aria-label="Filter by role">
        <option value="all">All roles</option>
        <option value="admin">Admin</option>
        <option value="super_admin">Super admin</option>
      </select>
      <select class="input w-auto" [ngModel]="status()" (ngModelChange)="status.set($event)" aria-label="Filter by status">
        <option value="all">All statuses</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
    </div>

    @if (users.error()) {
      <div class="card flex flex-col items-center gap-3 p-10 text-center">
        <p class="text-sm text-red-600">{{ users.error() }}</p>
        <button type="button" class="btn-outline" (click)="users.reload()">Retry</button>
      </div>
    } @else if (users.isLoading()) {
      <div class="card divide-y">
        @for (i of [1, 2, 3]; track i) {
          <div class="flex items-center gap-3 p-4">
            <div class="skeleton h-9 w-9 rounded-full"></div>
            <div class="flex-1 space-y-2"><div class="skeleton h-3 w-1/3"></div><div class="skeleton h-3 w-1/4"></div></div>
          </div>
        }
      </div>
    } @else if (filtered().length === 0) {
      <div class="card flex flex-col items-center gap-3 p-10 text-center">
        <app-icon name="users" [size]="32" />
        <p class="text-sm text-gray-500">{{ q() || role() !== 'all' || status() !== 'all' ? 'No admins match your filters.' : 'No admins yet.' }}</p>
        <button type="button" class="btn-primary" (click)="newUser()">Create the first admin</button>
      </div>
    } @else {
      <!-- Desktop table -->
      <div class="hidden overflow-hidden rounded-lg border bg-white md:block">
        <table class="table-admin">
          <thead><tr>
            <th>Email</th><th>Name</th><th>Role</th><th>Status</th><th>Last login</th>
            <th class="text-right">Actions</th>
          </tr></thead>
          <tbody>
            @for (u of filtered(); track u.id) {
              <tr>
                <td>
                  <div class="flex items-center gap-2.5">
                    <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand-dark">{{ initials(u.full_name || u.email) }}</span>
                    <span class="font-medium text-gray-900">{{ u.email }}</span>
                    @if (u.id === auth.user()?.id) { <span class="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">You</span> }
                  </div>
                </td>
                <td>{{ u.full_name }}</td>
                <td>@if (u.role === 'super_admin') { <app-badge tone="brand"><app-icon name="shield" [size]="12" /> Super admin</app-badge> } @else { <app-badge>Admin</app-badge> }</td>
                <td>@if (u.is_active) { <app-badge tone="green">Active</app-badge> } @else { <app-badge tone="gray">Inactive</app-badge> }</td>
                <td class="whitespace-nowrap text-gray-500"><span [title]="u.last_login_at | date: 'medium'">{{ u.last_login_at | date: 'MMM d, HH:mm' }}</span></td>
                <td class="whitespace-nowrap text-right">
                  <button type="button" class="icon-btn" title="Edit" aria-label="Edit {{ u.email }}" (click)="edit(u)"><app-icon name="pencil" [size]="16" /></button>
                  @if (u.id !== auth.user()?.id) {
                    <button type="button" class="icon-btn hover:bg-red-50 hover:text-red-600" title="Delete" aria-label="Delete {{ u.email }}" (click)="remove(u)"><app-icon name="trash" [size]="16" /></button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Mobile cards -->
      <div class="space-y-3 md:hidden">
        @for (u of filtered(); track u.id) {
          <div class="card p-4">
            <div class="flex items-start gap-3">
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand-dark">{{ initials(u.full_name || u.email) }}</span>
              <div class="min-w-0 flex-1">
                <p class="flex flex-wrap items-center gap-1.5 font-medium text-gray-900">
                  <span class="truncate">{{ u.email }}</span>
                  @if (u.id === auth.user()?.id) { <span class="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">You</span> }
                </p>
                <p class="text-sm text-gray-500">{{ u.full_name }}</p>
                <div class="mt-2 flex flex-wrap gap-1.5">
                  @if (u.role === 'super_admin') { <app-badge tone="brand">Super admin</app-badge> } @else { <app-badge>Admin</app-badge> }
                  @if (u.is_active) { <app-badge tone="green">Active</app-badge> } @else { <app-badge tone="gray">Inactive</app-badge> }
                </div>
                <p class="mt-2 text-xs text-gray-400">Last login {{ u.last_login_at | date: 'MMM d, HH:mm' }}</p>
              </div>
            </div>
            <div class="mt-3 flex gap-2 border-t pt-3">
              <button type="button" class="btn-outline flex-1" (click)="edit(u)"><app-icon name="pencil" [size]="16" /> Edit</button>
              @if (u.id !== auth.user()?.id) {
                <button type="button" class="btn-outline flex-1 !text-red-600 hover:!border-red-300" (click)="remove(u)"><app-icon name="trash" [size]="16" /> Delete</button>
              }
            </div>
          </div>
        }
      </div>
    }

    @if (form(); as f) {
      <app-side-panel (closed)="cancel()">
        <form class="flex h-full flex-col" (submit)="save($event)">
          <header class="flex items-center justify-between border-b px-5 py-4">
            <h2 class="font-semibold text-gray-900">{{ f.id ? 'Edit admin' : 'New admin' }}</h2>
            <button type="button" class="icon-btn" aria-label="Close panel" (click)="cancel()"><app-icon name="close" [size]="18" /></button>
          </header>
          <div class="flex-1 space-y-4 overflow-y-auto p-5">
            <div>
              <label class="label" for="u-email">Email</label>
              <input id="u-email" name="email" type="email" class="input" [disabled]="!!f.id" [(ngModel)]="f.email" required />
              @if (f.id) { <p class="mt-1 text-xs text-gray-400">Email cannot be changed.</p> }
            </div>
            <div>
              <label class="label" for="u-name">Full name</label>
              <input id="u-name" name="full_name" class="input" [(ngModel)]="f.full_name" />
            </div>
            <div>
              <label class="label" for="u-pass">{{ f.id ? 'New password (optional)' : 'Password' }}</label>
              <div class="relative">
                <input id="u-pass" name="password" [type]="showPassword() ? 'text' : 'password'" autocomplete="new-password" class="input !pr-10" [(ngModel)]="f.password" />
                <button type="button" class="icon-btn absolute right-1 top-1/2 -translate-y-1/2" (click)="showPassword.set(!showPassword())"
                        [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'">
                  <app-icon [name]="showPassword() ? 'eyeOff' : 'eye'" [size]="16" />
                </button>
              </div>
              <p class="mt-1 text-xs" [class.text-gray-500]="!passwordHint()" [class.text-amber-600]="passwordHint()">
                {{ passwordHint() || ('At least ' + minPassword + ' characters.') }}
              </p>
            </div>
            <div>
              <label class="label" for="u-role">Role</label>
              <select id="u-role" name="role" class="input" [(ngModel)]="f.role" [disabled]="isSelf(f)">
                <option value="admin">Admin</option>
                <option value="super_admin">Super admin</option>
              </select>
              @if (isSelf(f)) { <p class="mt-1 text-xs text-gray-500">You cannot change your own role.</p> }
            </div>
            <label class="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_active" [(ngModel)]="f.is_active" [disabled]="isSelf(f)" />
              Active
              @if (isSelf(f) && !f.is_active) { <span class="text-xs text-red-600">You cannot deactivate yourself.</span> }
            </label>
            @if (error()) { <p class="rounded bg-red-50 p-2 text-sm text-red-700" role="alert">{{ error() }}</p> }
          </div>
          <footer class="flex justify-end gap-2 border-t p-4">
            <button type="button" class="btn-outline" (click)="cancel()">Cancel</button>
            <button type="submit" class="btn-primary" [disabled]="saving()">
              @if (saving()) { Saving… } @else { Save }
            </button>
          </footer>
        </form>
      </app-side-panel>
    }
  `,
})
export class AdminUsers {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(Toast);
  private readonly confirmDialog = inject(ConfirmService);
  protected readonly auth = inject(AdminAuth);
  protected readonly minPassword = MIN_PASSWORD;
  protected readonly initials = initials;
  protected readonly users = rxResource({ stream: () => this.api.all<AdminUser>('users') });
  protected readonly form = signal<UserForm | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly q = signal('');
  protected readonly role = signal('all');
  protected readonly status = signal('all');

  protected readonly filtered = computed(() => filterUsers(this.users.value() ?? [], this.q(), this.role(), this.status()));
  protected readonly subtitle = computed(() => {
    const total = this.users.value()?.length ?? 0;
    if (!total) return '';
    return `${total} ${total === 1 ? 'admin' : 'admins'}`;
  });
  protected readonly passwordHint = computed(() => {
    const f = this.form();
    if (!f) return null;
    if (!f.password) return null;
    if (f.password.length < MIN_PASSWORD) return 'Too short — keep typing.';
    if (!/[A-Z]/.test(f.password) || !/[0-9]/.test(f.password)) return 'Consider an uppercase letter and a number for strength.';
    return null;
  });

  protected isSelf(f: UserForm): boolean {
    return f.id !== null && f.id === this.auth.user()?.id;
  }

  protected newUser(): void {
    this.showPassword.set(false);
    this.error.set(null);
    this.form.set({ id: null, email: '', full_name: '', password: '', role: 'admin', is_active: true });
  }

  protected edit(u: AdminUser): void {
    this.showPassword.set(false);
    this.error.set(null);
    this.form.set({ id: u.id, email: u.email, full_name: u.full_name, password: '', role: u.role, is_active: u.is_active });
  }

  protected cancel(): void {
    this.form.set(null);
    this.error.set(null);
  }

  protected save(event: Event): void {
    event.preventDefault();
    const f = this.form();
    if (!f || this.saving()) return;
    const pwError = passwordError(f.password, !!f.id);
    if (pwError) {
      this.error.set(pwError);
      return;
    }
    const body = f.id
      ? { full_name: f.full_name, role: f.role, is_active: this.isSelf(f) ? true : f.is_active, ...(f.password ? { password: f.password } : {}) }
      : { email: f.email, full_name: f.full_name, password: f.password, role: f.role, is_active: f.is_active };
    const req = f.id ? this.api.update('users', f.id, body) : this.api.create('users', body);
    this.saving.set(true);
    req.subscribe({
      next: () => {
        this.toast.show('Admin saved');
        this.cancel();
        this.saving.set(false);
        this.users.reload();
      },
      error: (e: unknown) => {
        this.error.set(apiError(e, 'Could not save'));
        this.saving.set(false);
      },
    });
  }

  protected async remove(u: AdminUser): Promise<void> {
    const ok = await this.confirmDialog.confirm('Delete admin', `Delete ${u.email}? This cannot be undone.`, { confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    this.api.remove('users', u.id).subscribe({ next: () => this.users.reload(), error: (e: unknown) => this.toast.error(apiError(e)) });
  }
}
