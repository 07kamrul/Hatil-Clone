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
    <div class="container-x py-8">
      <div class="mb-6 flex items-center justify-between">
        <h1 class="text-2xl font-bold sm:text-3xl">Compare products</h1>
        @if (compare.count()) { <button type="button" class="text-sm text-red-600 hover:underline" (click)="compare.clear()">Clear all</button> }
      </div>
      @if (items().length) {
        <div class="overflow-x-auto">
          <table class="w-full min-w-[40rem] border-collapse text-sm">
            <tbody>
              <tr>
                <th class="w-36"></th>
                @for (p of items(); track p.id) {
                  <td class="border p-3 align-top">
                    <a [routerLink]="['/product', p.slug]" class="relative mb-2 block aspect-square overflow-hidden rounded bg-gray-100">
                      @if (p.image) { <img [ngSrc]="p.image" [alt]="p.name" fill sizes="25vw" class="object-cover" /> }
                    </a>
                    <a [routerLink]="['/product', p.slug]" class="font-medium hover:text-brand">{{ p.name }}</a>
                    <div class="mt-2 flex gap-2">
                      <button type="button" class="btn-primary !px-2 !py-1 text-xs" (click)="add(p)">Add to cart</button>
                      <button type="button" class="btn-outline !px-2 !py-1 text-xs" (click)="compare.remove(p.id)">Remove</button>
                    </div>
                  </td>
                }
              </tr>
              @for (row of rows(); track row.label) {
                <tr>
                  <th class="border bg-gray-50 p-3 text-left font-medium">{{ row.label }}</th>
                  @for (value of row.values; track $index) { <td class="border p-3">{{ value }}</td> }
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (!products.isLoading()) {
        <div class="rounded-lg border border-dashed p-12 text-center">
          <p class="text-lg text-gray-600">Add up to 4 products to compare them side by side.</p>
          <a routerLink="/products" class="btn-primary mt-4">Browse products</a>
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
