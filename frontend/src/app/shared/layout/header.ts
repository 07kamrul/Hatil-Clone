import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
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
        <button type="button" class="lg:hidden" (click)="drawer.set(true)" aria-label="Open menu">
          <app-icon name="menu" [size]="26" />
        </button>
        <a
          routerLink="/"
          class="flex shrink-0 items-center text-xl font-bold tracking-tight text-brand xl:text-2xl"
          [attr.aria-label]="s().site_name + ' home'"
        >
          @if (s().logo_url) {
            <img
              [ngSrc]="s().logo_url!"
              [alt]="s().site_name"
              height="48"
              width="168"
              priority
              class="h-10 w-auto object-contain xl:h-12"
            />
          } @else {
            {{ s().site_name }}
          }
        </a>
        <div class="hidden flex-1 lg:block"><app-mega-menu [tree]="tree()" /></div>
        <nav class="ml-auto flex items-center gap-1 sm:gap-2 lg:ml-0" aria-label="Quick links">
          <button
            type="button"
            class="p-2 hover:text-brand"
            (click)="searchOpen.set(true)"
            aria-label="Search"
          >
            <app-icon name="search" [size]="24" />
          </button>
          <a
            routerLink="/wishlist"
            class="relative hidden p-2 hover:text-brand sm:block"
            [attr.aria-label]="'Wishlist ' + wishlist.count()"
            ><app-icon name="heart" [size]="24" />
            @if (wishlist.count()) {
              <span class="badge">{{ wishlist.count() }}</span>
            }
          </a>
          <a
            routerLink="/cart"
            class="relative p-2 hover:text-brand"
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
        <div class="relative bg-white py-8 shadow-xl">
          <div class="container-x flex items-center gap-3">
            <div class="flex-1" (click)="onSearchClick($event)"><app-search-box /></div>
            <button
              type="button"
              class="p-2"
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
          class="absolute inset-y-0 left-0 w-80 max-w-[85vw] overflow-y-auto bg-white p-4 shadow-xl"
        >
          <div class="mb-3 flex items-center justify-between">
            <span class="font-bold text-brand">{{ s().site_name }}</span>
            <button type="button" (click)="drawer.set(false)" aria-label="Close menu">
              <app-icon name="close" />
            </button>
          </div>
          <ul class="divide-y">
            @for (top of tree(); track top.id) {
              <li class="py-1">
                <div class="flex items-center justify-between">
                  <a
                    [routerLink]="['/category', top.slug]"
                    (click)="drawer.set(false)"
                    class="flex-1 py-2 font-medium"
                    >{{ top.name }}</a
                  >
                  @if (top.children.length) {
                    <button
                      type="button"
                      (click)="toggle(top.id)"
                      [attr.aria-expanded]="expanded() === top.id"
                      [attr.aria-label]="'Toggle ' + top.name"
                      class="p-2"
                    >
                      <app-icon name="chevronDown" [size]="18" />
                    </button>
                  }
                </div>
                @if (expanded() === top.id) {
                  <ul class="mb-2 ml-3 space-y-1 border-l pl-3">
                    @for (cat of top.children; track cat.id) {
                      <li>
                        <a
                          [routerLink]="['/category', cat.slug]"
                          (click)="drawer.set(false)"
                          class="block py-1 text-sm text-gray-700"
                          >{{ cat.name }}</a
                        >
                      </li>
                    }
                  </ul>
                }
              </li>
            }
            <li>
              <a routerLink="/showrooms" (click)="drawer.set(false)" class="block py-3 font-medium"
                >Showrooms</a
              >
            </li>
            <li>
              <a routerLink="/blog" (click)="drawer.set(false)" class="block py-3 font-medium"
                >Inspiration</a
              >
            </li>
            <li>
              <a routerLink="/contact" (click)="drawer.set(false)" class="block py-3 font-medium"
                >Contact</a
              >
            </li>
            <li>
              <a routerLink="/compare" (click)="drawer.set(false)" class="block py-3 font-medium"
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

  @HostListener('window:scroll')
  protected onScroll(): void {
    this.scrolled.set(window.scrollY > SCROLL_SHRINK_PX);
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.searchOpen.set(false);
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
