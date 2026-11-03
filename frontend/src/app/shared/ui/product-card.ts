import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CartStore } from '../../core/cart-store';
import { CompareStore, WishlistStore } from '../../core/lists';
import { ProductCard as ProductCardModel, STOCK_LABELS } from '../../core/models';
import { Toast } from '../../core/toast';
import { Icon } from './icon';
import { MoneyPipe } from './money-pipe';

@Component({
  selector: 'app-product-card',
  imports: [RouterLink, NgOptimizedImage, Icon, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="group card relative flex h-full flex-col overflow-hidden transition hover:shadow-md">
      <a [routerLink]="['/product', product().slug]" class="relative block aspect-square overflow-hidden bg-gray-100">
        @if (product().image) {
          <img [ngSrc]="product().image!" [alt]="product().name" fill sizes="(min-width:1024px) 25vw, 50vw"
               [priority]="priority()" [class]="product().image_hover ? 'object-cover transition duration-300 group-hover:opacity-0' : 'object-cover'" />
          @if (product().image_hover) {
            <img [ngSrc]="product().image_hover!" [alt]="product().name" fill sizes="(min-width:1024px) 25vw, 50vw"
                 class="absolute inset-0 object-cover opacity-0 transition duration-300 group-hover:opacity-100" />
          }
        } @else {
          <div class="flex h-full items-center justify-center text-sm text-gray-400">No image</div>
        }
        @if (product().discount_percent) {
          <span class="absolute left-2 top-2 rounded bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
            -{{ product().discount_percent }}%
          </span>
        }
        @if (product().stock_status !== 'in_stock') {
          <span class="absolute bottom-2 left-2 rounded bg-gray-900/80 px-2 py-0.5 text-xs text-white">
            {{ stockLabel() }}
          </span>
        }
      </a>
      <div class="absolute right-2 top-2 flex flex-col gap-1.5">
        <button type="button" (click)="wishlist.toggle(product().id)" [attr.aria-pressed]="wished()"
                [attr.aria-label]="wished() ? 'Remove from wishlist' : 'Add to wishlist'"
                class="rounded-full bg-white p-2 shadow hover:text-brand" [class.text-red-600]="wished()">
          <app-icon name="heart" [size]="16" />
        </button>
        <button type="button" (click)="toggleCompare()" [attr.aria-pressed]="compared()"
                [attr.aria-label]="compared() ? 'Remove from compare' : 'Add to compare'"
                class="rounded-full bg-white p-2 shadow hover:text-brand" [class.text-brand]="compared()">
          <app-icon name="compare" [size]="16" />
        </button>
      </div>
      <div class="flex flex-1 flex-col gap-1 p-3">
        @if (product().category) {
          <span class="text-xs uppercase tracking-wide text-gray-500">{{ product().category!.name }}</span>
        }
        <a [routerLink]="['/product', product().slug]" class="line-clamp-2 text-sm font-medium text-gray-900 hover:text-brand">
          {{ product().name }}
        </a>
        <div class="mt-auto flex items-baseline gap-2 pt-1">
          <span class="font-semibold text-brand">{{ product().final_price | money }}</span>
          @if (product().sale_price !== null) {
            <span class="text-xs text-gray-500 line-through">{{ product().price | money }}</span>
          }
        </div>
        @if (product().colors.length) {
          <div class="flex gap-1" aria-label="Available colours">
            @for (c of product().colors.slice(0, 5); track c.id) {
              <span class="h-3.5 w-3.5 rounded-full border border-gray-300" [style.background]="c.hex_code" [title]="c.name"></span>
            }
          </div>
        }
        <button type="button" (click)="addToCart()" [disabled]="product().stock_status === 'out_of_stock'"
                class="btn-outline mt-2 w-full">
          <app-icon name="cart" [size]="16" /> Add to cart
        </button>
      </div>
    </article>
  `,
})
export class ProductCardView {
  readonly product = input.required<ProductCardModel>();
  readonly priority = input(false);

  protected readonly wishlist = inject(WishlistStore);
  private readonly compare = inject(CompareStore);
  private readonly cart = inject(CartStore);
  private readonly toast = inject(Toast);

  protected readonly wished = computed(() => this.wishlist.ids().includes(this.product().id));
  protected readonly compared = computed(() => this.compare.ids().includes(this.product().id));
  protected readonly stockLabel = computed(() => STOCK_LABELS[this.product().stock_status]);

  protected toggleCompare(): void {
    if (!this.compare.toggle(this.product().id)) this.toast.error('You can compare up to 4 products');
  }

  protected addToCart(): void {
    const p = this.product();
    this.cart.add({ productId: p.id, slug: p.slug, sku: p.sku, name: p.name, image: p.image, variant: null, unitPrice: p.final_price });
    this.toast.show(`${p.name} added to cart`);
  }
}
