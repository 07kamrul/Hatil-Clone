import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { Api } from '../../core/api';
import { CartStore } from '../../core/cart-store';
import { CompareStore, RecentStore, WishlistStore } from '../../core/lists';
import { ProductCard, ProductDetail, ProductVariant, STOCK_LABELS } from '../../core/models';
import { Seo } from '../../core/seo';
import { SettingsStore } from '../../core/settings-store';
import { Toast } from '../../core/toast';
import { CartLine, buildOrderMessage, buildWhatsAppUrl, lineKey } from '../../core/whatsapp';
import { Breadcrumbs, Crumb } from '../../shared/ui/breadcrumbs';
import { Icon } from '../../shared/ui/icon';
import { MoneyPipe } from '../../shared/ui/money-pipe';
import { ProductCardView } from '../../shared/ui/product-card';
import { Gallery } from './gallery';

type Tab = 'description' | 'specs' | 'dimensions';
const MAX_QTY = 99;

export function variantLabel(v: ProductVariant): string {
  return [v.color?.name, v.size].filter(Boolean).join(' / ');
}

@Component({
  selector: 'app-product-page',
  imports: [RouterLink, Breadcrumbs, Gallery, Icon, MoneyPipe, ProductCardView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (product.value(); as p) {
      <app-breadcrumbs [crumbs]="crumbs()" />
      <article class="container-x grid gap-8 pb-8 md:grid-cols-2">
        <app-gallery [images]="p.images" [alt]="p.name" />

        <div>
          <h1 class="text-2xl font-bold sm:text-3xl">{{ p.name }}</h1>
          <p class="mt-1 text-sm text-gray-500">SKU: <span>{{ p.sku }}</span></p>

          <div class="mt-4 flex flex-wrap items-baseline gap-3">
            <span class="text-3xl font-bold text-brand">{{ unitPrice() | money }}</span>
            @if (p.sale_price !== null) {
              <span class="text-lg text-gray-500 line-through">{{ p.price + (variant()?.price_delta ?? 0) | money }}</span>
              <span class="rounded bg-red-600 px-2 py-0.5 text-sm font-semibold text-white">-{{ p.discount_percent }}%</span>
            }
          </div>
          <p class="mt-2 text-sm font-medium" [class]="p.stock_status === 'in_stock' ? 'text-green-700' : p.stock_status === 'out_of_stock' ? 'text-red-600' : 'text-amber-600'">
            {{ stockLabel() }}
          </p>

          @if (p.short_desc) { <p class="mt-4 text-gray-700">{{ p.short_desc }}</p> }

          @if (p.variants.length) {
            <fieldset class="mt-5">
              <legend class="mb-2 text-sm font-semibold">Options</legend>
              <div class="flex flex-wrap gap-2">
                @for (v of p.variants; track v.id) {
                  <button type="button" (click)="variantId.set(v.id)" [attr.aria-pressed]="variant()?.id === v.id"
                          class="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
                          [class]="variant()?.id === v.id ? 'border-brand bg-brand/10 text-brand' : 'hover:border-gray-500'">
                    @if (v.color?.hex_code) { <span class="h-4 w-4 rounded-full border" [style.background]="v.color!.hex_code"></span> }
                    {{ label(v) }}
                    @if (v.price_delta > 0) { <span class="text-xs text-gray-500">(+{{ v.price_delta | money }})</span> }
                  </button>
                }
              </div>
            </fieldset>
          }

          <div class="mt-5 flex items-center gap-3">
            <div class="flex items-center rounded-md border" role="group" aria-label="Quantity">
              <button type="button" class="p-2" (click)="qty.set(max(qty() - 1))" aria-label="Decrease quantity"><app-icon name="minus" [size]="16" /></button>
              <span class="w-8 text-center" aria-live="polite">{{ qty() }}</span>
              <button type="button" class="p-2" (click)="qty.set(max(qty() + 1))" aria-label="Increase quantity"><app-icon name="plus" [size]="16" /></button>
            </div>
            <button type="button" class="btn-primary flex-1" (click)="addToCart(p)" [disabled]="p.stock_status === 'out_of_stock'">
              <app-icon name="cart" [size]="18" /> Add to cart
            </button>
          </div>
          <button type="button" class="btn-whatsapp mt-3 w-full py-3 text-base" (click)="orderOnWhatsApp(p)">
            <app-icon name="whatsapp" [size]="20" /> Order on WhatsApp
          </button>

          <div class="mt-4 flex gap-4 text-sm">
            <button type="button" class="flex items-center gap-1 hover:text-brand" (click)="wishlist.toggle(p.id)" [attr.aria-pressed]="wishlist.ids().includes(p.id)">
              <app-icon name="heart" [size]="18" /> {{ wishlist.ids().includes(p.id) ? 'Saved' : 'Add to wishlist' }}
            </button>
            <button type="button" class="flex items-center gap-1 hover:text-brand" (click)="toggleCompare(p.id)" [attr.aria-pressed]="compare.ids().includes(p.id)">
              <app-icon name="compare" [size]="18" /> {{ compare.ids().includes(p.id) ? 'In compare' : 'Compare' }}
            </button>
          </div>

          @if (p.warranty) { <p class="mt-5 rounded-md bg-gray-50 p-3 text-sm"><strong>Warranty:</strong> {{ p.warranty }}</p> }
        </div>
      </article>

      <section class="container-x pb-8">
        <div role="tablist" class="flex gap-1 border-b">
          @for (t of tabs; track t.id) {
            <button type="button" role="tab" [attr.aria-selected]="tab() === t.id" (click)="tab.set(t.id)"
                    class="-mb-px border-b-2 px-4 py-2 text-sm font-medium"
                    [class]="tab() === t.id ? 'border-brand text-brand' : 'border-transparent text-gray-600'">{{ t.label }}</button>
          }
        </div>
        <div class="py-5" role="tabpanel">
          @switch (tab()) {
            @case ('description') {
              @if (p.description_html) { <div class="prose-content max-w-3xl" [innerHTML]="p.description_html"></div> }
              @else { <p class="text-gray-500">No description available.</p> }
            }
            @case ('specs') {
              @if (p.specs.length || p.materials.length || p.dimensions) {
                <table class="w-full max-w-2xl text-sm">
                  <tbody>
                    @if (p.dimensions) { <tr class="border-b"><th class="w-1/3 py-2 pr-3 text-left font-medium text-gray-600">Dimensions</th><td>{{ p.dimensions }}</td></tr> }
                    @if (p.materials.length) { <tr class="border-b"><th class="w-1/3 py-2 pr-3 text-left font-medium text-gray-600">Materials</th><td>{{ materialNames() }}</td></tr> }
                    @for (s of p.specs; track s.key) { <tr class="border-b"><th class="w-1/3 py-2 pr-3 text-left font-medium text-gray-600">{{ s.key }}</th><td>{{ s.value }}</td></tr> }
                  </tbody>
                </table>
              } @else { <p class="text-gray-500">No specifications available.</p> }
            }
            @case ('dimensions') {
              @if (p.dimensions) { <p class="mb-3">{{ p.dimensions }}</p> }
              <div class="flex flex-wrap gap-4">
                @for (img of dimensionImages(); track img.id) { <img [src]="img.url" [alt]="'Dimensions of ' + p.name" loading="lazy" class="max-h-96 rounded border" /> }
              </div>
              @if (!p.dimensions && !dimensionImages().length) { <p class="text-gray-500">Dimension details are not available.</p> }
            }
          }
        </div>
      </section>

      @if (related.value()?.length) {
        <section class="container-x pb-8"><h2 class="mb-4 text-xl font-bold">You may also like</h2>
          <div class="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">@for (r of related.value(); track r.id) { <app-product-card [product]="r" /> }</div></section>
      }
      @if (recent.value()?.length) {
        <section class="container-x pb-8"><h2 class="mb-4 text-xl font-bold">Recently viewed</h2>
          <div class="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">@for (r of recent.value(); track r.id) { <app-product-card [product]="r" /> }</div></section>
      }
    } @else if (product.isLoading()) {
      <div class="container-x py-24 text-center text-gray-500">Loading…</div>
    } @else {
      <div class="container-x py-24 text-center">
        <h1 class="text-2xl font-bold">Product not found</h1>
        <p class="mt-2 text-gray-600">It may have been removed or is no longer available.</p>
        <a routerLink="/products" class="btn-primary mt-6">Browse products</a>
      </div>
    }
  `,
})
export class ProductPage {
  /** Route parameter, bound by withComponentInputBinding(). */
  readonly slug = input.required<string>();

  private readonly api = inject(Api);
  private readonly seo = inject(Seo);
  private readonly settings = inject(SettingsStore);
  private readonly toast = inject(Toast);
  private readonly cart = inject(CartStore);
  private readonly recentStore = inject(RecentStore);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  protected readonly wishlist = inject(WishlistStore);
  protected readonly compare = inject(CompareStore);

  protected readonly tabs: { id: Tab; label: string }[] = [
    { id: 'description', label: 'Description' }, { id: 'specs', label: 'Specifications' }, { id: 'dimensions', label: 'Dimensions' },
  ];
  protected readonly tab = signal<Tab>('description');
  protected readonly qty = signal(1);
  protected readonly variantId = signal<number | null>(null);

  protected readonly product = rxResource<ProductDetail | undefined, string>({
    params: () => this.slug(),
    stream: ({ params }) =>
      this.api.product(params).pipe(
        catchError(() => {
          this.seo.setStatus(404);
          this.seo.set({ title: 'Product not found', noindex: true });
          return of(undefined);
        }),
      ),
  });

  protected readonly related = rxResource<ProductCard[], string | undefined>({
    params: () => (this.product.value() ? this.slug() : undefined),
    stream: ({ params }) => this.api.related(params, 4).pipe(catchError(() => of([] as ProductCard[]))),
  });

  /** Recently viewed lives in localStorage, so it is only resolved in the browser. */
  protected readonly recent = rxResource<ProductCard[], number[] | undefined>({
    params: () => {
      const current = this.product.value()?.id;
      return this.isBrowser && current ? this.recentStore.ids().filter((id) => id !== current).slice(0, 4) : undefined;
    },
    stream: ({ params }) => (params.length ? this.api.productsByIds(params).pipe(catchError(() => of([] as ProductCard[]))) : of([] as ProductCard[])),
  });

  protected readonly variant = computed(() => {
    const variants = this.product.value()?.variants ?? [];
    return variants.find((v) => v.id === this.variantId()) ?? variants[0] ?? null;
  });
  protected readonly unitPrice = computed(() => (this.product.value()?.final_price ?? 0) + (this.variant()?.price_delta ?? 0));
  protected readonly stockLabel = computed(() => STOCK_LABELS[this.product.value()?.stock_status ?? 'in_stock']);
  protected readonly materialNames = computed(() => (this.product.value()?.materials ?? []).map((m) => m.name).join(', '));
  protected readonly dimensionImages = computed(() => (this.product.value()?.images ?? []).filter((i) => i.is_dimension));
  protected readonly crumbs = computed<Crumb[]>(() => [
    ...(this.product.value()?.breadcrumbs ?? []).map((c) => ({ label: c.name, link: ['/category', c.slug] })),
    { label: this.product.value()?.name ?? '' },
  ]);

  protected readonly label = variantLabel;

  constructor() {
    effect(() => {
      const p = this.product.value();
      if (!p) return;
      this.variantId.set(null);
      this.qty.set(1);
      this.tab.set('description');
      if (this.isBrowser) this.recentStore.push(p.id);
      this.publishSeo(p);
    });
  }

  protected max(value: number): number {
    return Math.min(MAX_QTY, Math.max(1, value));
  }

  protected toggleCompare(id: number): void {
    if (!this.compare.toggle(id)) this.toast.error('You can compare up to 4 products');
  }

  private lineFor(p: ProductDetail): CartLine {
    const v = this.variant();
    const label = v ? variantLabel(v) || null : null;
    return {
      key: lineKey(p.id, label), productId: p.id, slug: p.slug, sku: v?.sku || p.sku, name: p.name,
      image: p.image, variant: label, unitPrice: this.unitPrice(), quantity: this.qty(),
    };
  }

  protected addToCart(p: ProductDetail): void {
    const { key: _key, ...line } = this.lineFor(p);
    this.cart.add(line);
    this.toast.show(`${p.name} added to cart`);
  }

  protected orderOnWhatsApp(p: ProductDetail): void {
    const s = this.settings.settings();
    const line = this.lineFor(p);
    const message = buildOrderMessage({
      template: s.message_template, siteName: s.site_name, currencySymbol: s.currency_symbol,
      origin: this.seo.origin(), lines: [line],
    });
    if (s.log_inquiries) {
      this.api.logInquiry([{ product_id: p.id, slug: p.slug, sku: line.sku, name: p.name, variant: line.variant, quantity: line.quantity, unit_price: line.unitPrice }], {}, 'product')
        .pipe(catchError(() => of(null))).subscribe();
    }
    window.open(buildWhatsAppUrl(s.whatsapp_number, message), '_blank', 'noopener');
  }

  private publishSeo(p: ProductDetail): void {
    const image = p.images[0]?.url ?? null;
    const url = this.seo.absolute(`/product/${p.slug}`);
    const availability = p.stock_status === 'out_of_stock' ? 'OutOfStock' : p.stock_status === 'pre_order' ? 'PreOrder' : 'InStock';
    this.seo.set({
      title: p.seo_title || p.name, description: p.seo_description || p.short_desc, image, path: `/product/${p.slug}`, type: 'product',
      jsonLd: [{
        '@context': 'https://schema.org', '@type': 'Product', name: p.name, sku: p.sku,
        description: p.seo_description || p.short_desc || undefined,
        image: p.images.filter((i) => !i.is_dimension).map((i) => this.seo.absolute(i.url)),
        category: p.category?.name, brand: { '@type': 'Brand', name: this.settings.settings().site_name },
        offers: {
          '@type': 'Offer', url, priceCurrency: this.settings.settings().currency, price: p.final_price,
          availability: `https://schema.org/${availability}`, itemCondition: 'https://schema.org/NewCondition',
        },
      }, {
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [...p.breadcrumbs.map((b) => ({ name: b.name, item: this.seo.absolute(`/category/${b.slug}`) })), { name: p.name, item: url }]
          .map((c, i) => ({ '@type': 'ListItem', position: i + 1, ...c })),
      }],
    });
  }
}
