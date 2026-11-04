import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { Api } from '../../core/api';
import { CartStore } from '../../core/cart-store';
import { CompareStore } from '../../core/lists';
import { ProductDetail, STOCK_LABELS } from '../../core/models';
import { Seo } from '../../core/seo';
import { Toast } from '../../core/toast';
import { MoneyPipe } from '../../shared/ui/money-pipe';

@Component({
  selector: 'app-compare-page',
  imports: [RouterLink, NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container-x page-y">
      <div class="mb-6 flex items-center justify-between gap-3">
        <h1 class="h-1">Compare products</h1>
        @if (compare.count()) { <button type="button" class="min-h-11 shrink-0 text-sm text-red-600 hover:underline" (click)="compare.clear()">Clear all</button> }
      </div>
      @if (items().length) {
        <p class="text-muted mb-2 sm:hidden">Swipe sideways to see every product.</p>
        <div class="table-wrap">
          <table class="w-full border-separate border-spacing-0 text-sm">
            <tbody>
              <tr>
                <th class="sticky left-0 z-10 w-28 bg-white sm:w-36"><span class="sr-only">Attribute</span></th>
                @for (p of items(); track p.id) {
                  <td class="min-w-44 max-w-64 border border-gray-200 p-3 align-top sm:min-w-52">
                    <a [routerLink]="['/product', p.slug]" class="relative mb-2 block aspect-square overflow-hidden rounded bg-gray-100">
                      @if (p.image) { <img [ngSrc]="p.image" [alt]="p.name" fill sizes="(min-width:1024px) 20vw, 45vw" class="object-cover" /> }
                    </a>
                    <a [routerLink]="['/product', p.slug]" class="line-clamp-2 font-medium hover:text-brand">{{ p.name }}</a>
                    <div class="mt-2 flex flex-col gap-2 sm:flex-row">
                      <button type="button" class="btn-primary flex-1 !px-2 text-xs" (click)="add(p)">Add to cart</button>
                      <button type="button" class="btn-outline flex-1 !px-2 text-xs" (click)="compare.remove(p.id)">Remove</button>
                    </div>
                  </td>
                }
              </tr>
              @for (row of rows(); track row.label) {
                <tr>
                  <th scope="row" class="sticky left-0 z-10 w-28 border border-gray-200 bg-gray-50 p-3 text-left align-top font-medium break-words sm:w-36">{{ row.label }}</th>
                  @for (value of row.values; track $index) { <td class="border border-gray-200 p-3 align-top break-words">{{ value }}</td> }
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (products.isLoading()) {
        <div class="skeleton h-80 w-full rounded-lg" aria-busy="true" aria-label="Loading comparison"></div>
      } @else {
        <div class="empty-state">
          <p class="h-3">Nothing to compare yet</p>
          <p class="text-muted">Add up to 4 products to compare them side by side.</p>
          <a routerLink="/products" class="btn-primary mt-2">Browse products</a>
        </div>
      }
    </div>
  `,
})
export class ComparePage {
  private readonly api = inject(Api);
  private readonly cart = inject(CartStore);
  private readonly toast = inject(Toast);
  private readonly money = new MoneyPipe();
  protected readonly compare = inject(CompareStore);

  protected readonly products = rxResource<ProductDetail[], readonly number[]>({
    params: () => this.compare.ids(),
    stream: ({ params }) => (params.length ? this.api.compare([...params]).pipe(catchError(() => of([] as ProductDetail[]))) : of([] as ProductDetail[])),
  });

  protected readonly items = computed(() => this.products.value() ?? []);

  protected readonly rows = computed(() => {
    const items = this.items();
    const specKeys = [...new Set(items.flatMap((p) => p.specs.map((s) => s.key) ?? []))];
    return [
      { label: 'Price', values: items.map((p) => this.money.transform(p.final_price)) },
      { label: 'Category', values: items.map((p) => p.category?.name ?? '—') },
      { label: 'Availability', values: items.map((p) => STOCK_LABELS[p.stock_status]) },
      { label: 'Dimensions', values: items.map((p) => p.dimensions ?? '—') },
      { label: 'Materials', values: items.map((p) => p.materials.map((m) => m.name).join(', ') || '—') },
      { label: 'Colours', values: items.map((p) => p.colors.map((c) => c.name).join(', ') || '—') },
      { label: 'Warranty', values: items.map((p) => p.warranty ?? '—') },
      ...specKeys.map((key) => ({ label: key, values: items.map((p) => p.specs.find((s) => s.key === key)?.value ?? '—') })),
    ];
  });

  constructor() {
    inject(Seo).set({ title: 'Compare products', path: '/compare', noindex: true });
  }

  protected add(p: ProductDetail): void {
    this.cart.add({ productId: p.id, slug: p.slug, sku: p.sku, name: p.name, image: p.image, variant: null, unitPrice: p.final_price });
    this.toast.show(`${p.name} added to cart`);
  }
}
