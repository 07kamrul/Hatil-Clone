import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { Api } from '../../core/api';
import { WishlistStore } from '../../core/lists';
import { ProductCard } from '../../core/models';
import { Seo } from '../../core/seo';
import { ProductCardView } from '../../shared/ui/product-card';

@Component({
  selector: 'app-wishlist-page',
  imports: [RouterLink, ProductCardView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container-x page-y">
      <div class="mb-6 flex items-center justify-between gap-3">
        <h1 class="heading-1">Wishlist</h1>
        @if (wishlist.count()) { <button type="button" class="min-h-11 shrink-0 text-sm text-red-600 hover:underline" (click)="wishlist.clear()">Clear all</button> }
      </div>
      @if (products.value()?.length) {
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          @for (p of products.value(); track p.id) { <app-product-card [product]="p" /> }
        </div>
      } @else if (products.isLoading()) {
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4" aria-busy="true" aria-label="Loading wishlist">
          @for (n of [1, 2, 3, 4]; track n) { <div class="skeleton aspect-[3/4] rounded-lg"></div> }
        </div>
      } @else {
        <div class="empty-state">
          <p class="heading-3">Your wishlist is empty</p>
          <p class="text-muted">Tap the heart on a product to save it here.</p>
          <a routerLink="/products" class="btn-primary mt-2">Browse products</a>
        </div>
      }
    </div>
  `,
})
export class WishlistPage {
  private readonly api = inject(Api);
  protected readonly wishlist = inject(WishlistStore);

  protected readonly products = rxResource<ProductCard[], readonly number[]>({
    params: () => this.wishlist.ids(),
    stream: ({ params }) => (params.length ? this.api.productsByIds([...params]).pipe(catchError(() => of([] as ProductCard[]))) : of([] as ProductCard[])),
  });

  constructor() {
    inject(Seo).set({ title: 'Wishlist', path: '/wishlist', noindex: true });
  }
}
