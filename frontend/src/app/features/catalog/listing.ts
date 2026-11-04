import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { Api } from '../../core/api';
import { CategoryDetail, ProductFacets, ProductQuery, SortKey } from '../../core/models';
import { Seo } from '../../core/seo';
import { useScrollLock } from '../../core/scroll-lock';
import { Breadcrumbs, Crumb } from '../../shared/ui/breadcrumbs';
import { MoneyPipe } from '../../shared/ui/money-pipe';
import { Pagination } from '../../shared/ui/pagination';
import { ProductCardView } from '../../shared/ui/product-card';

const PAGE_SIZE = 24;
const SORTS: { value: SortKey; label: string }[] = [
  { value: 'new', label: 'Newest' },
  { value: 'popular', label: 'Most popular' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'name', label: 'Name A–Z' },
];
const LIST_KEYS = ['colors', 'materials', 'rooms', 'availability'] as const;
type ListKey = (typeof LIST_KEYS)[number];

const csv = (value: string | null): string[] => (value ? value.split(',').filter(Boolean) : []);
const num = (value: string | null): number | null => {
  const n = value === null || value === '' ? NaN : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

@Component({
  selector: 'app-listing',
  imports: [RouterLink, FormsModule, NgTemplateOutlet, Breadcrumbs, ProductCardView, Pagination, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closeFilters()' },
  template: `
    <app-breadcrumbs [crumbs]="crumbs()" />
    <div class="container-x pb-10">
      <header class="mb-4">
        <h1 class="heading-1 break-words">{{ heading() }}</h1>
        @if (category.value(); as c) {
          @if (c.children.length) {
            <ul class="scroll-x mt-3 gap-2 sm:flex-wrap sm:overflow-visible">
              @for (child of c.children; track child.id) {
                <li><a [routerLink]="['/category', child.slug]" class="chip min-h-11 whitespace-nowrap">{{ child.name }}</a></li>
              }
            </ul>
          }
        }
      </header>

      <div class="sticky top-[68px] z-20 -mx-4 mb-4 flex items-center justify-between gap-2 border-y border-gray-200 bg-white/95 px-4 py-2 backdrop-blur sm:mx-0 sm:px-0 lg:static lg:bg-transparent lg:py-3 lg:backdrop-blur-none">
        <button #filtersBtn type="button" class="btn-outline shrink-0 lg:hidden" (click)="filtersOpen.set(true)" [attr.aria-expanded]="filtersOpen()" aria-controls="listing-filters">
          Filters @if (activeFilterCount()) { <span class="pill bg-brand text-white">{{ activeFilterCount() }}</span> }
        </button>
        <p class="hidden text-sm text-gray-600 sm:block" aria-live="polite">
          @if (products.value(); as p) { {{ p.total }} product{{ p.total === 1 ? '' : 's' }} }
        </p>
        <label class="flex min-w-0 items-center gap-2 text-sm"><span class="hidden sm:inline">Sort by</span>
          <select class="input !w-auto max-w-[55vw] sm:max-w-none" aria-label="Sort by" [ngModel]="query().sort" (ngModelChange)="update({ sort: $event === 'new' ? null : $event })">
            @for (s of sorts; track s.value) { <option [value]="s.value">{{ s.label }}</option> }
          </select>
        </label>
      </div>

      <p class="-mt-2 mb-3 text-sm text-gray-600 sm:hidden" aria-hidden="true">
        @if (products.value(); as p) { {{ p.total }} product{{ p.total === 1 ? '' : 's' }} }
      </p>
      <div class="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
        @if (filtersOpen()) {
          <button type="button" class="fixed inset-0 z-40 bg-black/50 lg:hidden" aria-label="Close filters" (click)="filtersOpen.set(false)"></button>
        }
        <aside id="listing-filters" [class.hidden]="!filtersOpen()"
               class="fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] space-y-6 overflow-y-auto overscroll-contain bg-white px-4 pb-24 shadow-xl lg:static lg:z-auto lg:!block lg:w-auto lg:max-w-none lg:overflow-visible lg:p-0 lg:shadow-none" aria-label="Filters">
          <div class="sticky top-0 z-10 -mx-4 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2 lg:hidden">
            <span class="heading-3">Filters</span>
            <button #filtersClose type="button" class="icon-btn min-h-11 min-w-11 text-xl" aria-label="Close filters" (click)="filtersOpen.set(false)">&times;</button>
          </div>
          @if (activeFilterCount()) { <button type="button" class="min-h-11 text-sm text-brand underline" (click)="clearFilters()">Clear all filters</button> }

          @if (facets.value(); as f) {
            <fieldset>
              <legend class="mb-2 font-semibold">Price</legend>
              <div class="flex items-center gap-2">
                <input type="number" inputmode="numeric" min="0" class="input" placeholder="Min" aria-label="Minimum price" [(ngModel)]="minPrice" />
                <span>–</span>
                <input type="number" inputmode="numeric" min="0" class="input" placeholder="Max" aria-label="Maximum price" [(ngModel)]="maxPrice" />
              </div>
              @if (f.max_price > 0) { <p class="mt-1 text-xs text-gray-500">Range: {{ f.min_price | money }} – {{ f.max_price | money }}</p> }
              <button type="button" class="btn-outline mt-2 w-full" (click)="applyPrice()">Apply</button>
            </fieldset>

            <label class="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" class="size-4 accent-brand" [checked]="query().on_sale" (change)="update({ on_sale: $any($event.target).checked ? 'true' : null })" />
              On sale only
            </label>

            @if (f.availability.length) { <ng-container [ngTemplateOutlet]="group" [ngTemplateOutletContext]="{ title: 'Availability', key: 'availability', options: f.availability }" /> }
            @if (f.rooms.length) { <ng-container [ngTemplateOutlet]="group" [ngTemplateOutletContext]="{ title: 'Room', key: 'rooms', options: f.rooms }" /> }
            @if (f.colors.length) { <ng-container [ngTemplateOutlet]="group" [ngTemplateOutletContext]="{ title: 'Colour', key: 'colors', options: f.colors }" /> }
            @if (f.materials.length) { <ng-container [ngTemplateOutlet]="group" [ngTemplateOutletContext]="{ title: 'Material', key: 'materials', options: f.materials }" /> }
          }
          <div class="fixed bottom-0 left-0 w-80 max-w-[85vw] border-t border-gray-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden">
            <button type="button" class="btn-primary w-full" (click)="filtersOpen.set(false)">
              Show @if (products.value(); as p) { {{ p.total }} } results
            </button>
          </div>
        </aside>

        <section aria-label="Products">
          @if (products.isLoading() && !products.value()) {
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4" aria-busy="true" aria-label="Loading products">
              @for (n of [1, 2, 3, 4, 5, 6, 7, 8]; track n) {
                <div class="card overflow-hidden">
                  <div class="skeleton aspect-square rounded-none"></div>
                  <div class="space-y-2 p-3"><div class="skeleton h-3 w-1/3"></div><div class="skeleton h-4 w-4/5"></div><div class="skeleton h-4 w-1/2"></div><div class="skeleton mt-2 h-11 w-full"></div></div>
                </div>
              }
            </div>
          } @else if (products.value(); as p) {
            @if (p.items.length) {
              <div class="grid grid-cols-2 gap-3 transition-opacity sm:grid-cols-3 sm:gap-4 xl:grid-cols-4" [class.opacity-60]="products.isLoading()" [attr.aria-busy]="products.isLoading()">
                @for (item of p.items; track item.id; let i = $index) { <app-product-card [product]="item" [priority]="i < 3" /> }
              </div>
              <app-pagination [page]="p.page" [pages]="p.pages" (pageChange)="update({ page: $event === 1 ? null : $event })" />
            } @else {
              <div class="empty-state">
                <p class="heading-3">No products match your filters.</p>
                <p class="text-muted">Try removing a filter or browsing all products.</p>
                @if (activeFilterCount()) {
                  <button type="button" class="btn-primary mt-2" (click)="clearFilters()">Clear filters</button>
                } @else {
                  <a routerLink="/products" class="btn-primary mt-2">Browse all products</a>
                }
              </div>
            }
          } @else if (products.error()) {
            <div class="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700" role="alert">We couldn't load products. <button type="button" class="ml-1 min-h-11 font-medium underline" (click)="products.reload()">Try again</button></div>
          }
          @if (category.value()?.description_html; as html) {
            <div class="prose-content mt-10 border-t border-gray-200 pt-6 break-words text-sm text-gray-700" [innerHTML]="html"></div>
          }
        </section>
      </div>
    </div>

    <ng-template #group let-title="title" let-key="key" let-options="options">
      <fieldset>
        <legend class="mb-2 font-semibold">{{ title }}</legend>
        <ul class="max-h-64 overflow-auto lg:max-h-52">
          @for (o of options; track o.slug) {
            <li>
              <label class="flex min-h-11 cursor-pointer items-center gap-2 text-sm lg:min-h-9">
                <input type="checkbox" class="size-4 accent-brand" [checked]="isChecked(key, o.slug)" (change)="toggle(key, o.slug)" />
                @if (o.hex_code) { <span class="h-3.5 w-3.5 rounded-full border" [style.background]="o.hex_code"></span> }
                <span class="flex-1">{{ o.name }}</span><span class="text-xs text-gray-400">{{ o.count }}</span>
              </label>
            </li>
          }
        </ul>
      </fieldset>
    </ng-template>
  `,
})
export class Listing {
  private readonly api = inject(Api);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly seo = inject(Seo);

  protected readonly sorts = SORTS;
  protected readonly filtersOpen = signal(false);
  protected minPrice: number | null = null;
  protected maxPrice: number | null = null;

  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  private readonly queryParams = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  private readonly mode = (this.route.snapshot.data['mode'] as 'all' | 'category' | 'search') ?? 'all';
  private readonly slug = computed(() => this.params().get('slug'));

  protected readonly query = computed<ProductQuery>(() => {
    const q = this.queryParams();
    return {
      q: this.mode === 'search' ? (q.get('q') ?? '') : undefined,
      category: this.mode === 'category' ? (this.slug() ?? undefined) : undefined,
      min_price: num(q.get('min_price')),
      max_price: num(q.get('max_price')),
      colors: csv(q.get('colors')),
      materials: csv(q.get('materials')),
      rooms: csv(q.get('rooms')),
      availability: csv(q.get('availability')),
      featured: q.get('featured') === 'true' || undefined,
      best_seller: q.get('best_seller') === 'true' || undefined,
      on_sale: q.get('on_sale') === 'true' || undefined,
      sort: (SORTS.find((s) => s.value === q.get('sort'))?.value ?? 'new') as SortKey,
      page: Math.max(1, Number(q.get('page')) || 1),
      page_size: PAGE_SIZE,
    };
  });

  protected readonly products = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.api.products(params),
  });

  protected readonly facets = rxResource<ProductFacets | undefined, ProductQuery>({
    params: () => ({ category: this.query().category, q: this.query().q }),
    stream: ({ params }) => this.api.facets(params).pipe(catchError(() => of(undefined))),
  });

  protected readonly category = rxResource<CategoryDetail | undefined, string | undefined>({
    params: () => (this.mode === 'category' ? (this.slug() ?? undefined) : undefined),
    stream: ({ params }) =>
      this.api.category(params as string).pipe(
        catchError(() => {
          this.seo.setStatus(404);
          return of(undefined);
        }),
      ),
  });

  protected readonly heading = computed(() => {
    if (this.mode === 'search') return `Search results for “${this.query().q ?? ''}”`;
    if (this.mode === 'category') return this.category.value()?.name ?? 'Products';
    return 'All products';
  });

  protected readonly crumbs = computed<Crumb[]>(() => {
    if (this.mode === 'category') {
      const trail = this.category.value()?.breadcrumbs ?? [];
      return trail.map((c, i) => (i === trail.length - 1 ? { label: c.name } : { label: c.name, link: ['/category', c.slug] }));
    }
    return [{ label: this.mode === 'search' ? 'Search' : 'Products' }];
  });

  protected readonly activeFilterCount = computed(() => {
    const q = this.query();
    return (q.colors?.length ?? 0) + (q.materials?.length ?? 0) + (q.rooms?.length ?? 0) + (q.availability?.length ?? 0)
      + (q.min_price !== null && q.min_price !== undefined ? 1 : 0) + (q.max_price !== null && q.max_price !== undefined ? 1 : 0)
      + (q.on_sale ? 1 : 0);
  });

  private readonly filtersBtn = viewChild<ElementRef<HTMLButtonElement>>('filtersBtn');
  private readonly filtersClose = viewChild<ElementRef<HTMLButtonElement>>('filtersClose');

  /** Mobile filter drawer: Esc closes it and focus returns to the "Filters" button. */
  protected closeFilters(): void {
    if (!this.filtersOpen()) return;
    this.filtersOpen.set(false);
    this.filtersBtn()?.nativeElement.focus();
  }

  constructor() {
    useScrollLock(this.filtersOpen);
    effect(() => {
      if (this.filtersOpen()) setTimeout(() => this.filtersClose()?.nativeElement.focus());
    });
    effect(() => {
      const q = this.query();
      this.minPrice = q.min_price ?? null;
      this.maxPrice = q.max_price ?? null;
    });
    effect(() => {
      const c = this.category.value();
      const total = this.products.value()?.total;
      const path = this.router.url.split('?')[0];
      if (this.mode === 'category' && c) {
        this.seo.set({
          title: c.seo_title || c.name, description: c.seo_description, image: c.banner_image || c.image, path,
          jsonLd: [{
            '@context': 'https://schema.org', '@type': 'BreadcrumbList',
            itemListElement: c.breadcrumbs.map((b, i) => ({ '@type': 'ListItem', position: i + 1, name: b.name, item: this.seo.absolute(`/category/${b.slug}`) })),
          }],
        });
      } else if (this.mode !== 'category') {
        this.seo.set({ title: this.heading(), description: total !== undefined ? `${total} products` : undefined, path, noindex: this.mode === 'search' });
      }
    });
  }

  protected isChecked(key: ListKey, slug: string): boolean {
    return (this.query()[key] ?? []).includes(slug);
  }

  protected toggle(key: ListKey, slug: string): void {
    const current = this.query()[key] ?? [];
    const next = current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug];
    this.update({ [key]: next.length ? next.join(',') : null });
  }

  protected applyPrice(): void {
    this.update({ min_price: this.minPrice ?? null, max_price: this.maxPrice ?? null });
  }

  protected clearFilters(): void {
    const reset: Params = { min_price: null, max_price: null, on_sale: null };
    for (const key of LIST_KEYS) reset[key] = null;
    this.update(reset);
  }

  protected update(patch: Params): void {
    const resetsPage = !('page' in patch);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...patch, ...(resetsPage ? { page: null } : {}) },
      queryParamsHandling: 'merge',
    });
  }
}
