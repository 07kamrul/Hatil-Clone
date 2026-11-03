import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { STOCK_LABELS } from '../../../core/models';
import { Toast } from '../../../core/toast';
import { MoneyPipe } from '../../../shared/ui/money-pipe';
import { AdminApi, ImportResult, apiError, downloadBlob } from '../core/admin-api';

const PAGE_SIZE = 25;

@Component({
  selector: 'app-admin-products',
  imports: [RouterLink, FormsModule, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-bold">Products</h1>
      <div class="flex flex-wrap gap-2">
        <label class="btn-outline cursor-pointer">{{ importing() ? 'Importing…' : 'Import CSV/Excel' }}
          <input type="file" accept=".csv,.xlsx" class="hidden" [disabled]="importing()" (change)="import($event)" /></label>
        <button type="button" class="btn-outline" (click)="export('csv')">Export CSV</button>
        <button type="button" class="btn-outline" (click)="export('xlsx')">Export Excel</button>
        <a routerLink="new" class="btn-primary">+ New product</a>
      </div>
    </div>

    @if (importResult(); as r) {
      <div class="mb-4 rounded-md border bg-white p-3 text-sm">
        <strong>Import finished:</strong> {{ r.created }} created, {{ r.updated }} updated, {{ r.failed }} failed.
        @if (r.errors.length) { <ul class="mt-2 max-h-40 list-disc overflow-auto pl-5 text-red-700">@for (e of r.errors; track $index) { <li>{{ e }}</li> }</ul> }
        <button type="button" class="mt-2 text-xs underline" (click)="importResult.set(null)">Dismiss</button>
      </div>
    }

    <div class="mb-3 flex flex-wrap gap-2">
      <input type="search" class="input max-w-xs" placeholder="Search name or SKU…" [ngModel]="q()" (ngModelChange)="q.set($event); page.set(1)" aria-label="Search products" />
      <select class="input !w-auto" [ngModel]="published()" (ngModelChange)="published.set($event); page.set(1)" aria-label="Publish state">
        <option value="">All</option><option value="true">Published</option><option value="false">Unpublished</option>
      </select>
      <select class="input !w-auto" [ngModel]="sort()" (ngModelChange)="sort.set($event)" aria-label="Sort">
        <option value="new">Newest</option><option value="name">Name</option><option value="price_asc">Price ↑</option><option value="price_desc">Price ↓</option><option value="popular">Most viewed</option>
      </select>
    </div>

    @if (selected().size) {
      <div class="mb-3 flex flex-wrap items-center gap-2 rounded-md bg-brand/10 p-3 text-sm">
        <strong>{{ selected().size }} selected</strong>
        <button type="button" class="btn-outline !py-1" (click)="publish(true)">Publish</button>
        <button type="button" class="btn-outline !py-1" (click)="publish(false)">Unpublish</button>
        <span class="mx-1 text-gray-400">|</span>
        <select class="input !w-auto !py-1" [(ngModel)]="priceMode"><option value="percent">Change price by %</option><option value="fixed">Change price by amount</option><option value="set">Set price to</option></select>
        <select class="input !w-auto !py-1" [(ngModel)]="priceTarget"><option value="price">Regular price</option><option value="sale_price">Sale price</option></select>
        <input type="number" class="input !w-28 !py-1" [(ngModel)]="priceValue" placeholder="e.g. 10" aria-label="Value" />
        <label class="flex items-center gap-1">round to <input type="number" min="0" class="input !w-20 !py-1" [(ngModel)]="roundTo" /></label>
        <button type="button" class="btn-primary !py-1" (click)="bulkPrice()">Apply</button>
        <span class="mx-1 text-gray-400">|</span>
        <button type="button" class="btn-danger !py-1" (click)="bulkDelete()">Delete</button>
        <button type="button" class="ml-auto text-xs underline" (click)="clearSelection()">Clear selection</button>
      </div>
    }

    <div class="overflow-x-auto rounded-lg border bg-white">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 text-left">
          <tr>
            <th class="w-8 px-3 py-2"><input type="checkbox" [checked]="allSelected()" (change)="toggleAll()" aria-label="Select all on page" /></th>
            <th class="px-3 py-2"></th><th class="px-3 py-2">Name</th><th class="px-3 py-2">SKU</th><th class="px-3 py-2">Category</th>
            <th class="px-3 py-2">Price</th><th class="px-3 py-2">Stock</th><th class="px-3 py-2">Status</th><th class="px-3 py-2">Views</th>
          </tr>
        </thead>
        <tbody>
          @for (p of products.value()?.items; track p.id) {
            <tr class="border-t hover:bg-gray-50">
              <td class="px-3 py-2"><input type="checkbox" [checked]="selected().has(p.id)" (change)="toggle(p.id)" [attr.aria-label]="'Select ' + p.name" /></td>
              <td class="px-3 py-2">@if (p.image) { <img [src]="p.image" alt="" class="h-10 w-10 rounded object-cover" /> }</td>
              <td class="px-3 py-2"><a [routerLink]="[p.id]" class="font-medium hover:text-brand">{{ p.name }}</a>
                @if (p.is_featured) { <span class="ml-1 rounded bg-amber-100 px-1 text-xs">featured</span> }</td>
              <td class="px-3 py-2 text-gray-600">{{ p.sku }}</td>
              <td class="px-3 py-2 text-gray-600">{{ p.category?.name }}</td>
              <td class="whitespace-nowrap px-3 py-2">{{ p.final_price | money }}@if (p.sale_price !== null) { <span class="ml-1 text-xs text-gray-400 line-through">{{ p.price | money }}</span> }</td>
              <td class="px-3 py-2">{{ stock[p.stock_status] }}</td>
              <td class="px-3 py-2"><span [class]="p.is_published ? 'text-green-700' : 'text-gray-400'">{{ p.is_published ? 'Published' : 'Hidden' }}</span></td>
              <td class="px-3 py-2 text-gray-600">{{ p.view_count }}</td>
            </tr>
          } @empty {
            <tr><td colspan="9" class="px-3 py-8 text-center text-gray-500">{{ products.isLoading() ? 'Loading…' : 'No products found.' }}</td></tr>
          }
        </tbody>
      </table>
    </div>
    @if (products.value(); as r) {
      <div class="mt-4 flex items-center gap-3 text-sm">
        <span class="text-gray-600">{{ r.total }} products</span>
        @if (r.pages > 1) {
          <button type="button" class="btn-outline" [disabled]="page() <= 1" (click)="page.set(page() - 1)">Prev</button>
          <span>Page {{ page() }} of {{ r.pages }}</span>
          <button type="button" class="btn-outline" [disabled]="page() >= r.pages" (click)="page.set(page() + 1)">Next</button>
        }
      </div>
    }
  `,
})
export class AdminProducts {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(Toast);

  protected readonly stock = STOCK_LABELS;
  protected readonly q = signal('');
  protected readonly published = signal('');
  protected readonly sort = signal('new');
  protected readonly page = signal(1);
  protected readonly selected = signal(new Set<number>());
  protected readonly importing = signal(false);
  protected readonly importResult = signal<ImportResult | null>(null);
  protected priceMode = 'percent';
  protected priceTarget = 'price';
  protected priceValue: number | null = null;
  protected roundTo = 0;

  protected readonly products = rxResource({
    params: () => ({ q: this.q(), published: this.published(), sort: this.sort(), page: this.page(), page_size: PAGE_SIZE }),
    stream: ({ params }) => this.api.products(params),
  });

  protected readonly allSelected = computed(() => {
    const items = this.products.value()?.items ?? [];
    return items.length > 0 && items.every((p) => this.selected().has(p.id));
  });

  protected clearSelection(): void {
    this.selected.set(new Set());
  }

  protected toggle(id: number): void {
    this.selected.update((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  protected toggleAll(): void {
    const ids = (this.products.value()?.items ?? []).map((p) => p.id);
    const all = this.allSelected();
    this.selected.update((s) => {
      const next = new Set(s);
      ids.forEach((id) => (all ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  private done(message: string): void {
    this.toast.show(message);
    this.selected.set(new Set());
    this.products.reload();
  }

  protected publish(state: boolean): void {
    this.api.bulkPublish([...this.selected()], state).subscribe({ next: (r) => this.done(r.detail), error: (e: unknown) => this.toast.error(apiError(e)) });
  }

  protected bulkPrice(): void {
    if (this.priceValue === null || Number.isNaN(Number(this.priceValue))) {
      this.toast.error('Enter a value');
      return;
    }
    this.api.bulkPrice({ ids: [...this.selected()], mode: this.priceMode, value: Number(this.priceValue), target: this.priceTarget, round_to: Number(this.roundTo) || 0 })
      .subscribe({ next: (r) => this.done(r.detail), error: (e: unknown) => this.toast.error(apiError(e)) });
  }

  protected bulkDelete(): void {
    if (!confirm(`Delete ${this.selected().size} products and their images? This cannot be undone.`)) return;
    this.api.bulkDelete([...this.selected()]).subscribe({ next: (r) => this.done(r.detail), error: (e: unknown) => this.toast.error(apiError(e)) });
  }

  protected import(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.importing.set(true);
    this.api.importProducts(file).subscribe({
      next: (r) => {
        this.importing.set(false);
        this.importResult.set(r);
        this.products.reload();
      },
      error: (e: unknown) => {
        this.importing.set(false);
        this.toast.error(apiError(e, 'Import failed'));
      },
    });
  }

  protected export(fmt: 'csv' | 'xlsx'): void {
    this.api.exportProducts(fmt).subscribe({
      next: (blob) => downloadBlob(blob, `products-${new Date().toISOString().slice(0, 10)}.${fmt}`),
      error: (e: unknown) => this.toast.error(apiError(e, 'Export failed')),
    });
  }
}
