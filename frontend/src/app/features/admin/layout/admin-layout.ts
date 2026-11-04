import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';

import { Seo } from '../../../core/seo';
import { SettingsStore } from '../../../core/settings-store';
import { Icon } from '../../../shared/ui/icon';
import { AdminAuth } from '../core/admin-auth';
import { BrowserStorage } from '../../../core/browser-storage';

interface NavItem { path: string; label: string; icon: string; superOnly?: boolean }
const NAV: { group: string; items: NavItem[] }[] = [
  { group: 'Overview', items: [{ path: '/admin', label: 'Dashboard', icon: 'dashboard' }] },
  { group: 'Catalog', items: [
    { path: '/admin/products', label: 'Products', icon: 'tag' }, { path: '/admin/categories', label: 'Categories', icon: 'layers' },
    { path: '/admin/colors', label: 'Colours', icon: 'image' }, { path: '/admin/materials', label: 'Materials', icon: 'image' }, { path: '/admin/rooms', label: 'Rooms', icon: 'image' },
  ] },
  { group: 'Content', items: [
    { path: '/admin/banners', label: 'Banners', icon: 'image' }, { path: '/admin/showrooms', label: 'Showrooms', icon: 'pin' },
    { path: '/admin/blog', label: 'Blog', icon: 'doc' }, { path: '/admin/pages', label: 'Pages', icon: 'doc' }, { path: '/admin/faqs', label: 'FAQs', icon: 'chat' },
  ] },
  { group: 'Inbox', items: [
    { path: '/admin/inquiries', label: 'Order inquiries', icon: 'inbox' }, { path: '/admin/messages', label: 'Contact messages', icon: 'mail' },
  ] },
  { group: 'System', items: [
    { path: '/admin/settings', label: 'Settings', icon: 'cog' }, { path: '/admin/users', label: 'Admin users', icon: 'users', superOnly: true },
  ] },
];
const COLLAPSE_KEY = 'admin.sidebar-collapsed';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'open.set(false)' },
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-40 bg-gray-900/50 lg:hidden" (click)="open.set(false)" aria-hidden="true"></div>
    }
    <div class="min-h-screen bg-gray-100 lg:flex">
      <aside
        class="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-gray-900 text-gray-300 transition-transform lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0"
        [class.-translate-x-full]="!open()"
        [class.lg:w-16]="collapsed()"
        [attr.aria-hidden]="!open()"
      >
        <div class="flex items-center gap-2 px-4 py-4" [class.lg:justify-center]="collapsed()" [class.lg:px-2]="collapsed()">
          <a routerLink="/admin" class="flex items-center gap-2 font-bold text-white">
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand text-sm text-white">{{ initial() }}</span>
            @if (!collapsed()) { <span class="truncate">{{ settings.settings().site_name }} <span class="text-xs font-normal text-gray-400">admin</span></span> }
          </a>
          <button type="button" class="ml-auto text-gray-400 hover:text-white lg:hidden" (click)="open.set(false)" aria-label="Close menu">
            <app-icon name="close" [size]="20" />
          </button>
        </div>
        <nav class="flex-1 overflow-y-auto pb-4" aria-label="Admin">
          @for (g of nav; track g.group) {
            <p class="px-4 pb-1 pt-4 text-xs uppercase tracking-wider text-gray-500" [class.lg:text-center]="collapsed()" [class.lg:px-1]="collapsed()">
              @if (collapsed()) { <span class="sr-only">{{ g.group }}</span> } @else { <span>{{ g.group }}</span> }
            </p>
            @for (item of g.items; track item.path) {
              @if (!item.superOnly || auth.isSuperAdmin()) {
                <a
                  [routerLink]="item.path"
                  routerLinkActive="bg-gray-800 text-white"
                  [routerLinkActiveOptions]="{ exact: item.path === '/admin' }"
                  (click)="open.set(false)"
                  class="relative mx-2 flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-gray-800 hover:text-white"
                  [class.justify-center]="collapsed()"
                  [class.px-2]="collapsed()"
                  [title]="item.label"
                >
                  <app-icon [name]="item.icon" [size]="18" />
                  @if (!collapsed()) { {{ item.label }} }
                </a>
              }
            }
          }
        </nav>
        <div class="border-t border-gray-800 p-2">
          <button
            type="button"
            class="hidden w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white lg:flex"
            [class.justify-center]="collapsed()"
            [class.px-2]="collapsed()"
            (click)="toggleCollapse()"
            [attr.aria-expanded]="!collapsed()"
            [title]="collapsed() ? 'Expand sidebar' : 'Collapse sidebar'"
          >
            <app-icon name="chevron" [size]="18" [class.rotate-180]="!collapsed()" />
            @if (!collapsed()) { Collapse }
          </button>
        </div>
      </aside>
      <div class="flex min-w-0 flex-1 flex-col">
        <header class="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
          <button type="button" class="icon-btn lg:hidden" (click)="open.set(true)" aria-label="Open menu">
            <app-icon name="menu" [size]="20" />
          </button>
          <p class="truncate text-sm font-semibold text-gray-900">{{ pageTitle() }}</p>
          <a routerLink="/" class="icon-btn" target="_blank" title="View site" aria-label="View site (opens in a new tab)">
            <app-icon name="external" [size]="18" />
          </a>
          <div class="ml-auto flex items-center gap-2">
            <div class="relative">
              <button
                type="button"
                class="flex items-center gap-2 rounded-full p-1 pr-2 text-sm transition hover:bg-gray-100"
                (click)="menuOpen.set(!menuOpen())"
                aria-haspopup="menu"
                [attr.aria-expanded]="menuOpen()"
                aria-label="Account menu"
              >
                <span class="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand-dark">{{ initial() }}</span>
                <span class="hidden max-w-40 truncate text-gray-700 sm:block">{{ auth.user()?.email }}</span>
                <app-icon name="chevronDown" [size]="16" />
              </button>
              @if (menuOpen()) {
                <div role="menu" class="absolute right-0 z-40 mt-2 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  <a role="menuitem" routerLink="/admin/account" (click)="menuOpen.set(false)" class="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    <app-icon name="shield" [size]="16" /> My account
                  </a>
                  <button role="menuitem" type="button" class="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50" (click)="logout()">
                    <app-icon name="logout" [size]="16" /> Sign out
                  </button>
                </div>
              }
            </div>
          </div>
        </header>
        <main class="flex-1 p-4 sm:p-6"><router-outlet /></main>
      </div>
    </div>
  `,
})
export class AdminLayout {
  protected readonly auth = inject(AdminAuth);
  protected readonly settings = inject(SettingsStore);
  protected readonly storage = inject(BrowserStorage);
  protected readonly nav = NAV;
  protected readonly open = signal(false);
  protected readonly menuOpen = signal(false);
  protected readonly collapsed = signal(this.storage.get(COLLAPSE_KEY, false));
  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), map((e) => e.urlAfterRedirects), startWith(this.router.url)),
    { initialValue: this.router.url },
  );
  protected readonly initial = computed(() => (this.auth.user()?.email ?? '?').charAt(0).toUpperCase());

  protected toggleCollapse(): void {
    this.collapsed.update((c) => !c);
    this.storage.set(COLLAPSE_KEY, this.collapsed());
  }

  protected logout(): void {
    this.menuOpen.set(false);
    void this.auth.logout();
  }

  protected readonly pageTitle = computed(() => {
    const url = this.url();
    if (url.startsWith('/admin/account')) return 'My account';
    if (url.startsWith('/admin/users')) return 'Admin users';
    if (url.startsWith('/admin/settings')) return 'Settings';
    const labels: [string, string][] = [
      ['/admin/products/', 'Edit product'], ['/admin/products', 'Products'], ['/admin/categories', 'Categories'],
      ['/admin/inquiries', 'Order inquiries'], ['/admin/messages', 'Contact messages'],
    ];
    for (const [prefix, label] of labels) {
      if (url.startsWith(prefix)) return label;
    }
    for (const g of NAV) {
      for (const item of g.items) {
        if (url.startsWith(item.path)) return item.label;
      }
    }
    return 'Dashboard';
  });

  constructor() {
    inject(Seo).set({ title: 'Admin', noindex: true });
  }
}
