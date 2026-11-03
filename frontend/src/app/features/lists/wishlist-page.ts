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
    <div class="container-x py-8">
      <div class="mb-6 flex items-center justify-between">
        <h1 class="text-2xl font-bold sm:text-3xl">Wishlist</h1>
        @if (wishlist.count()) { <button type="button" class="text-sm text-red-600 hover:underline" (click)="wishlist.clear()">Clear all</button> }
      </div>
      @if (products.value()?.length) {
        <div class="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          @for (p of products.value(); track p.id) { <app-product-card [product]="p" /> }
        </div>
      } @else if (!products.isLoading()) {
        <div class="rounded-lg border border-dashed p-12 text-center">
          <p class="text-lg text-gray-600">You haven't saved anything yet. Tap the heart on a product to save it.</p>
          <a routerLink="/products" class="btn-primary mt-4">Browse products</a>
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
