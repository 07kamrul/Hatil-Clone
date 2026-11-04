import { DOCUMENT, NgOptimizedImage, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { Api } from '../../core/api';
import { CartStore } from '../../core/cart-store';
import { CategoryNode } from '../../core/models';
import { WishlistStore } from '../../core/lists';
import { SettingsStore } from '../../core/settings-store';
import { Icon } from '../ui/icon';
import { MegaMenu } from './mega-menu';
import { orderNav } from './nav-split';
import { SearchBox } from './search-box';

const SCROLL_SHRINK_PX = 24;

@Component({
  selector: 'app-header',
  imports: [RouterLink, NgOptimizedImage, Icon, MegaMenu, SearchBox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header
      class="sticky top-0 z-40 bg-white transition-shadow duration-200"
      [class.shadow-md]="scrolled()"
      [style.--header-h.px]="scrolled() ? 68 : 88"
    >
      <div
        class="relative flex items-center gap-3 px-4 transition-[height] duration-200 sm:px-6 lg:px-5"
        [style.height.px]="scrolled() ? 68 : 88"
      >
        <button
          type="button"
          class="icon-btn -ml-2 min-h-11 min-w-11 text-gray-800 lg:hidden"
          (click)="drawer.set(true)"
          aria-label="Open menu"
          [attr.aria-expanded]="drawer()"
        >
          <app-icon name="menu" [size]="26" />
        </button>
        <a
          routerLink="/"
          class="flex min-w-0 shrink items-center truncate rounded-md text-xl focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none font-bold tracking-tight text-brand xl:text-2xl"
          [attr.aria-label]="s().site_name + ' home'"
        >
          @if (s().logo_url) {
            <img
              [ngSrc]="s().logo_url!"
              [alt]="s().site_name"
              height="48"
              width="168"
              priority
              class="h-9 w-auto max-w-[45vw] object-contain sm:h-10 xl:h-12"
            />
          } @else {
            {{ s().site_name }}
          }
        </a>
        <div class="hidden flex-1 lg:block"><app-mega-menu [tree]="tree()" /></div>
        <nav class="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1 lg:ml-0" aria-label="Quick links">
          <button
            type="button"
            class="icon-btn relative min-h-11 min-w-11 text-gray-800 hover:text-brand"
            (click)="searchOpen.set(true)"
            aria-label="Search"
          >
            <app-icon name="search" [size]="24" />
          </button>
          <a
            routerLink="/wishlist"
            class="icon-btn relative hidden min-h-11 min-w-11 text-gray-800 hover:text-brand sm:inline-flex"
            [attr.aria-label]="'Wishlist ' + wishlist.count()"
            ><app-icon name="heart" [size]="24" />
            @if (wishlist.count()) {
              <span class="badge">{{ wishlist.count() }}</span>
            }
          </a>
          <a
            routerLink="/cart"
            class="icon-btn relative min-h-11 min-w-11 text-gray-800 hover:text-brand"
            [attr.aria-label]="'Cart ' + cart.count()"
            ><app-icon name="cart" [size]="24" /> <span class="badge">{{ cart.count() }}</span></a
          >
        </nav>
      </div>
    </header>

    @if (searchOpen()) {
      <div class="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Search">
        <button
          type="button"
          class="absolute inset-0 bg-black/50"
          (click)="searchOpen.set(false)"
          aria-label="Close search"
        ></button>
        <div class="relative bg-white py-4 shadow-xl sm:py-8">
          <div class="container-x flex items-center gap-3">
            <div class="flex-1" (click)="onSearchClick($event)"><app-search-box /></div>
            <button
              type="button"
              class="icon-btn min-h-11 min-w-11"
              (click)="searchOpen.set(false)"
              aria-label="Close search"
            >
              <app-icon name="close" />
            </button>
          </div>
        </div>
      </div>
    }

    @if (drawer()) {
      <div class="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
        <button
          type="button"
          class="absolute inset-0 bg-black/50"
          (click)="drawer.set(false)"
          aria-label="Close menu"
        ></button>
        <div
          class="absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col overflow-y-auto overscroll-contain bg-white shadow-xl"
        >
          <div
            class="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2"
          >
            <span class="truncate font-bold text-brand">{{ s().site_name }}</span>
            <button
              type="button"
              class="icon-btn min-h-11 min-w-11"
              (click)="drawer.set(false)"
              aria-label="Close menu"
            >
              <app-icon name="close" />
            </button>
          </div>
          <ul class="divide-y divide-gray-100 px-4 pb-6">
            @for (top of navTree(); track top.id) {
              <li class="py-1">
                <div class="flex items-center justify-between">
                  <a
                    [routerLink]="['/category', top.slug]"
                    (click)="drawer.set(false)"
                    class="flex min-h-12 flex-1 items-center font-medium hover:text-brand"
                    >{{ top.name }}</a
                  >
                  @if (top.children.length) {
                    <button
                      type="button"
                      (click)="toggle(top.id)"
                      [attr.aria-expanded]="expanded() === top.id"
                      [attr.aria-label]="'Toggle ' + top.name"
                      class="icon-btn min-h-11 min-w-11"
                    >
                      <app-icon
                        name="chevronDown"
                        [size]="18"
                        class="transition-transform"
                        [class.rotate-180]="expanded() === top.id"
                      />
                    </button>
                  }
                </div>
                @if (expanded() === top.id) {
                  <ul class="mb-2 ml-1 border-l border-gray-200 pl-3">
                    @for (cat of top.children; track cat.id) {
                      <li>
                        <a
                          [routerLink]="['/category', cat.slug]"
                          (click)="drawer.set(false)"
                          class="flex min-h-11 items-center text-sm text-gray-700 hover:text-brand"
                          >{{ cat.name }}</a
                        >
                      </li>
                    }
                  </ul>
                }
              </li>
            }
            <li>
              <a routerLink="/showrooms" (click)="drawer.set(false)" class="flex min-h-12 items-center font-medium hover:text-brand"
                >Showrooms</a
              >
            </li>
            <li>
              <a routerLink="/blog" (click)="drawer.set(false)" class="flex min-h-12 items-center font-medium hover:text-brand"
                >Inspiration</a
              >
            </li>
            <li>
              <a routerLink="/contact" (click)="drawer.set(false)" class="flex min-h-12 items-center font-medium hover:text-brand"
                >Contact</a
              >
            </li>
            <li>
              <a routerLink="/compare" (click)="drawer.set(false)" class="flex min-h-12 items-center font-medium hover:text-brand"
                >Compare</a
              >
            </li>
          </ul>
        </div>
      </div>
    }
  `,
  styles: `
    .badge {
      position: absolute;
      top: 0;
      right: 0;
      font-weight: 600;
      min-width: 1.1rem;
      height: 1.1rem;
      border-radius: 9999px;
      background: #dc2626;
      color: #fff;
      font-size: 0.65rem;
      line-height: 1.1rem;
      text-align: center;
      padding: 0 0.25rem;
    }
  `,
})
export class Header {
  private readonly api = inject(Api);
  protected readonly settings = inject(SettingsStore);
  protected readonly cart = inject(CartStore);
  protected readonly wishlist = inject(WishlistStore);

  protected readonly s = this.settings.settings;
  protected readonly drawer = signal(false);
  protected readonly searchOpen = signal(false);
  protected readonly scrolled = signal(false);
  protected readonly expanded = signal<number | null>(null);
  protected readonly tree = toSignal(
    this.api.categoryTree().pipe(catchError(() => of<CategoryNode[]>([]))),
    { initialValue: [] as CategoryNode[] },
  );

  protected readonly navTree = computed(() => orderNav(this.tree()));

  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor() {
    // Lock page scroll while an overlay is open (browser only; SSR never touches body).
    effect(() => {
      const locked = this.drawer() || this.searchOpen();
      if (this.isBrowser) this.document.body.style.overflow = locked ? 'hidden' : '';
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.isBrowser) this.document.body.style.overflow = '';
    });
  }

  @HostListener('window:scroll')
  protected onScroll(): void {
    this.scrolled.set(window.scrollY > SCROLL_SHRINK_PX);
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.searchOpen.set(false);
      this.drawer.set(false);
      return;
    }
    const target = e.target as HTMLElement | null;
    const isTyping = !!target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
    if (e.key === '/' && !isTyping) {
      e.preventDefault();
      this.searchOpen.set(true);
    }
  }

  /** Close the overlay once a result link inside the search box is clicked. */
  protected onSearchClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).closest('a')) this.searchOpen.set(false);
  }

  protected toggle(id: number): void {
    this.expanded.update((current) => (current === id ? null : id));
  }
}
