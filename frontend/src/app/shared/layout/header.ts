import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { Api } from '../../core/api';
import { CartStore } from '../../core/cart-store';
import { CategoryNode } from '../../core/models';
import { CompareStore, WishlistStore } from '../../core/lists';
import { SettingsStore } from '../../core/settings-store';
import { Icon } from '../ui/icon';
import { MegaMenu } from './mega-menu';
import { SearchBox } from './search-box';

@Component({
  selector: 'app-header',
  imports: [RouterLink, NgOptimizedImage, Icon, MegaMenu, SearchBox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="sticky top-0 z-40 bg-white shadow-sm">
      <div class="hidden bg-accent text-xs text-white md:block">
        <div class="container-x flex items-center justify-between py-1.5">
          <span class="flex items-center gap-2"><app-icon name="phone" [size]="14" /> Hotline: {{ s().hotline }}</span>
          <span class="flex gap-4">
            <a routerLink="/showrooms" class="hover:underline">Find a showroom</a>
            <a routerLink="/contact" class="hover:underline">Contact</a>
          </span>
        </div>
      </div>
      <div class="container-x flex items-center gap-3 py-3">
        <button type="button" class="lg:hidden" (click)="drawer.set(true)" aria-label="Open menu"><app-icon name="menu" [size]="26" /></button>
        <a routerLink="/" class="flex shrink-0 items-center gap-2 text-xl font-bold text-brand" [attr.aria-label]="s().site_name + ' home'">
          @if (s().logo_url) {
            <img [ngSrc]="s().logo_url!" [alt]="s().site_name" height="40" width="140" priority class="h-10 w-auto object-contain" />
          } @else { {{ s().site_name }} }
        </a>
        <div class="mx-2 hidden flex-1 md:block"><app-search-box /></div>
        <nav class="ml-auto flex items-center gap-1 sm:gap-3" aria-label="Quick links">
          <a routerLink="/compare" class="relative p-2 hover:text-brand" aria-label="Compare"><app-icon name="compare" [size]="22" />
            @if (compare.count()) { <span class="badge">{{ compare.count() }}</span> }</a>
          <a routerLink="/wishlist" class="relative p-2 hover:text-brand" aria-label="Wishlist"><app-icon name="heart" [size]="22" />
            @if (wishlist.count()) { <span class="badge">{{ wishlist.count() }}</span> }</a>
          <a routerLink="/cart" class="relative p-2 hover:text-brand" aria-label="Cart"><app-icon name="cart" [size]="22" />
            @if (cart.count()) { <span class="badge">{{ cart.count() }}</span> }</a>
        </nav>
      </div>
      <div class="container-x pb-3 md:hidden"><app-search-box /></div>
      <div class="hidden border-t lg:block"><div class="container-x"><app-mega-menu [tree]="tree()" /></div></div>
    </header>

    @if (drawer()) {
      <div class="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
        <button type="button" class="absolute inset-0 bg-black/50" (click)="drawer.set(false)" aria-label="Close menu"></button>
        <div class="absolute inset-y-0 left-0 w-80 max-w-[85vw] overflow-y-auto bg-white p-4 shadow-xl">
          <div class="mb-3 flex items-center justify-between">
            <span class="font-bold text-brand">{{ s().site_name }}</span>
            <button type="button" (click)="drawer.set(false)" aria-label="Close menu"><app-icon name="close" /></button>
          </div>
          <ul class="divide-y">
            @for (top of tree(); track top.id) {
              <li class="py-1">
                <div class="flex items-center justify-between">
                  <a [routerLink]="['/category', top.slug]" (click)="drawer.set(false)" class="flex-1 py-2 font-medium">{{ top.name }}</a>
                  @if (top.children.length) {
                    <button type="button" (click)="toggle(top.id)" [attr.aria-expanded]="expanded() === top.id"
                            [attr.aria-label]="'Toggle ' + top.name" class="p-2"><app-icon name="chevronDown" [size]="18" /></button>
                  }
                </div>
                @if (expanded() === top.id) {
                  <ul class="mb-2 ml-3 space-y-1 border-l pl-3">
                    @for (cat of top.children; track cat.id) {
                      <li><a [routerLink]="['/category', cat.slug]" (click)="drawer.set(false)" class="block py-1 text-sm text-gray-700">{{ cat.name }}</a></li>
                    }
                  </ul>
                }
              </li>
            }
            <li><a routerLink="/showrooms" (click)="drawer.set(false)" class="block py-3 font-medium">Showrooms</a></li>
            <li><a routerLink="/blog" (click)="drawer.set(false)" class="block py-3 font-medium">Inspiration</a></li>
            <li><a routerLink="/contact" (click)="drawer.set(false)" class="block py-3 font-medium">Contact</a></li>
          </ul>
        </div>
      </div>
    }
  `,
  styles: `.badge { position: absolute; top: 0; right: 0; min-width: 1.1rem; height: 1.1rem; border-radius: 9999px; background: var(--color-brand); color: #fff; font-size: .65rem; line-height: 1.1rem; text-align: center; padding: 0 .25rem; }`,
})
export class Header {
  private readonly api = inject(Api);
  protected readonly settings = inject(SettingsStore);
  protected readonly cart = inject(CartStore);
  protected readonly wishlist = inject(WishlistStore);
  protected readonly compare = inject(CompareStore);

  protected readonly s = this.settings.settings;
  protected readonly drawer = signal(false);
  protected readonly expanded = signal<number | null>(null);
  protected readonly tree = toSignal(
    this.api.categoryTree().pipe(catchError(() => of<CategoryNode[]>([]))),
    { initialValue: [] as CategoryNode[] },
  );

  protected toggle(id: number): void {
    this.expanded.update((current) => (current === id ? null : id));
  }
}
