import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { Seo } from '../../../core/seo';
import { SettingsStore } from '../../../core/settings-store';
import { AdminAuth } from '../core/admin-auth';

interface NavItem { path: string; label: string; superOnly?: boolean }
const NAV: { group: string; items: NavItem[] }[] = [
  { group: 'Overview', items: [{ path: '/admin', label: 'Dashboard' }] },
  { group: 'Catalog', items: [
    { path: '/admin/products', label: 'Products' }, { path: '/admin/categories', label: 'Categories' },
    { path: '/admin/colors', label: 'Colours' }, { path: '/admin/materials', label: 'Materials' }, { path: '/admin/rooms', label: 'Rooms' },
  ] },
  { group: 'Content', items: [
    { path: '/admin/banners', label: 'Banners' }, { path: '/admin/showrooms', label: 'Showrooms' },
    { path: '/admin/blog', label: 'Blog' }, { path: '/admin/pages', label: 'Pages' }, { path: '/admin/faqs', label: 'FAQs' },
  ] },
  { group: 'Inbox', items: [{ path: '/admin/inquiries', label: 'Order inquiries' }, { path: '/admin/messages', label: 'Contact messages' }] },
  { group: 'System', items: [{ path: '/admin/settings', label: 'Settings' }, { path: '/admin/users', label: 'Admin users', superOnly: true }, { path: '/admin/account', label: 'My account' }] },
];

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-gray-100 lg:flex">
      <aside class="bg-gray-900 text-gray-300 lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:shrink-0 lg:overflow-y-auto" [class.hidden]="!open()" [class.lg:block]="true">
        <div class="flex items-center justify-between px-4 py-4">
          <a routerLink="/admin" class="font-bold text-white">{{ settings.settings().site_name }} <span class="text-xs font-normal text-gray-400">admin</span></a>
          <button type="button" class="lg:hidden" (click)="open.set(false)" aria-label="Close menu">✕</button>
        </div>
        <nav aria-label="Admin">
          @for (g of nav; track g.group) {
            <p class="px-4 pb-1 pt-4 text-xs uppercase tracking-wider text-gray-500">{{ g.group }}</p>
            @for (item of g.items; track item.path) {
              @if (!item.superOnly || auth.isSuperAdmin()) {
                <a [routerLink]="item.path" routerLinkActive="bg-gray-800 text-white" [routerLinkActiveOptions]="{ exact: item.path === '/admin' }"
                   (click)="open.set(false)" class="block px-4 py-2 text-sm hover:bg-gray-800 hover:text-white">{{ item.label }}</a>
              }
            }
          }
        </nav>
      </aside>
      <div class="flex-1">
        <header class="flex items-center gap-3 border-b bg-white px-4 py-3">
          <button type="button" class="lg:hidden" (click)="open.set(true)" aria-label="Open menu">☰</button>
          <a href="/" target="_blank" class="text-sm text-gray-600 hover:underline">View site ↗</a>
          <span class="ml-auto text-sm text-gray-600">{{ auth.user()?.email }}</span>
          <button type="button" class="btn-outline !py-1" (click)="auth.logout()">Sign out</button>
        </header>
        <main class="p-4 sm:p-6"><router-outlet /></main>
      </div>
    </div>
  `,
})
export class AdminLayout {
  protected readonly auth = inject(AdminAuth);
  protected readonly settings = inject(SettingsStore);
  protected readonly nav = NAV;
  protected readonly open = signal(false);

  constructor() {
    inject(Seo).set({ title: 'Admin', noindex: true });
  }
}
