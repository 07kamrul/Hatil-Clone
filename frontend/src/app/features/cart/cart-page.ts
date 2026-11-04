import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { Api } from '../../core/api';
import { BrowserStorage } from '../../core/browser-storage';
import { CartStore, MAX_QUANTITY } from '../../core/cart-store';
import { Seo } from '../../core/seo';
import { SettingsStore } from '../../core/settings-store';
import { CustomerDetails, buildOrderMessage, buildWhatsAppUrl } from '../../core/whatsapp';
import { Icon } from '../../shared/ui/icon';
import { MoneyPipe } from '../../shared/ui/money-pipe';

const CUSTOMER_KEY = 'checkout.customer.v1';

@Component({
  selector: 'app-cart-page',
  imports: [RouterLink, FormsModule, NgOptimizedImage, Icon, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container-x page-y">
      <h1 class="heading-1 mb-6">Your cart @if (!cart.isEmpty()) { <span class="text-muted font-normal">({{ cart.count() }})</span> }</h1>
      @if (cart.isEmpty()) {
        <div class="empty-state">
          <app-icon name="cart" [size]="40" />
          <p class="heading-3">Your cart is empty.</p>
          <p class="text-muted">Browse the catalog and add pieces you love.</p>
          <a routerLink="/products" class="btn-primary mt-2">Start shopping</a>
        </div>
      } @else {
        <div class="grid gap-6 pb-24 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-8 lg:pb-0">
          <ul class="space-y-3 sm:space-y-0 sm:divide-y sm:divide-gray-200 sm:rounded-lg sm:border sm:border-gray-200">
            @for (line of cart.lines(); track line.key) {
              <li class="card relative flex gap-3 p-3 sm:gap-4 sm:rounded-none sm:border-0 sm:p-4 sm:shadow-none">
                <a [routerLink]="['/product', line.slug]" class="relative h-20 w-20 shrink-0 overflow-hidden rounded bg-gray-100 sm:h-24 sm:w-24">
                  @if (line.image) { <img [ngSrc]="line.image" [alt]="line.name" width="96" height="96" class="h-full w-full object-cover" /> }
                </a>
                <div class="flex min-w-0 flex-1 flex-col gap-1">
                  <a [routerLink]="['/product', line.slug]" class="line-clamp-2 pr-2 font-medium hover:text-brand">{{ line.name }}</a>
                  <span class="text-xs text-gray-500">SKU: {{ line.sku }}</span>
                  @if (line.variant) { <span class="text-sm text-gray-600">{{ line.variant }}</span> }
                  <span class="text-sm">{{ line.unitPrice | money }}@if (line.unitPrice > 0) { each }<span class="font-semibold text-gray-900 sm:hidden"> · {{ line.unitPrice * line.quantity | money }}</span></span>
                  <div class="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
                    <div class="flex items-center rounded-md border border-gray-300" role="group" [attr.aria-label]="'Quantity of ' + line.name">
                      <button type="button" class="icon-btn min-h-11 min-w-11" (click)="cart.setQuantity(line.key, line.quantity - 1)" aria-label="Decrease"><app-icon name="minus" [size]="14" /></button>
                      <input type="number" min="1" [max]="maxQty" class="h-11 w-12 border-x border-gray-300 text-center text-base sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40" inputmode="numeric" [ngModel]="line.quantity"
                             (ngModelChange)="cart.setQuantity(line.key, +$event)" aria-label="Quantity" />
                      <button type="button" class="icon-btn min-h-11 min-w-11" (click)="cart.setQuantity(line.key, line.quantity + 1)" aria-label="Increase"><app-icon name="plus" [size]="14" /></button>
                    </div>
                    <button type="button" class="min-h-11 px-1 text-sm text-red-600 hover:underline" (click)="cart.remove(line.key)">Remove</button>
                  </div>
                </div>
                <div class="hidden shrink-0 font-semibold sm:block">{{ line.unitPrice * line.quantity | money }}</div>
              </li>
            }
          </ul>

          <aside class="card h-fit p-4 sm:p-5 lg:sticky lg:top-24">
            <h2 class="heading-3 mb-3">Order summary</h2>
            <div class="flex justify-between text-sm"><span>Items</span><span>{{ cart.count() }}</span></div>
            <div class="mt-2 flex justify-between border-t border-gray-200 pt-2 text-lg font-bold"><span>Total</span><span class="text-brand">{{ cart.total() | money }}</span></div>
            <p class="mt-1 text-xs text-gray-500">Delivery charge and final price are confirmed on WhatsApp.</p>

            <form id="checkout-form" class="mt-5 space-y-3" (submit)="checkout($event)">
              <p class="text-sm font-medium">Your details <span class="font-normal text-gray-500">(optional, added to the message)</span></p>
              <div><label class="label" for="c-name">Name</label><input #nameInput id="c-name" name="name" autocomplete="name" class="input" maxlength="200" [(ngModel)]="customer.name" /></div>
              <div><label class="label" for="c-phone">Phone</label><input id="c-phone" name="phone" type="tel" autocomplete="tel" class="input" maxlength="50" [(ngModel)]="customer.phone" /></div>
              <div><label class="label" for="c-address">Delivery address</label><textarea id="c-address" name="address" rows="2" class="input" maxlength="500" [(ngModel)]="customer.address"></textarea></div>
              <div><label class="label" for="c-note">Note</label><textarea id="c-note" name="note" rows="2" class="input" maxlength="1000" [(ngModel)]="customer.note"></textarea></div>
              <button type="submit" class="btn-whatsapp w-full py-3 text-base" [disabled]="!hasNumber()">
                <app-icon name="whatsapp" [size]="20" /> Checkout via WhatsApp
              </button>
              @if (!hasNumber()) { <p class="text-xs text-red-600">WhatsApp ordering is not configured yet.</p> }
              <button type="button" class="min-h-11 w-full text-sm text-gray-500 hover:underline" (click)="preview.set(!preview())">
                {{ preview() ? 'Hide' : 'Preview' }} message</button>
              @if (preview()) { <pre class="max-h-72 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs">{{ message() }}</pre> }
            </form>
            @if (sent()) {
              <div class="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-800">
                WhatsApp opened with your order. <button type="button" class="min-h-11 font-medium underline" (click)="clear()">Clear cart</button>
              </div>
            }
          </aside>
        </div>
        <div class="sticky-bar flex items-center gap-3 lg:hidden">
          <div class="mr-auto">
            <p class="text-xs text-gray-500">Total · {{ cart.count() }} item{{ cart.count() === 1 ? '' : 's' }}</p>
            <p class="text-lg font-bold text-brand">{{ cart.total() | money }}</p>
          </div>
          <button type="button" class="btn-whatsapp shrink-0" (click)="nameInput.focus()">
            <app-icon name="whatsapp" [size]="18" /> Checkout
          </button>
        </div>
      }
    </div>
  `,
})
export class CartPage {
  protected readonly cart = inject(CartStore);
  private readonly settings = inject(SettingsStore);
  private readonly api = inject(Api);
  private readonly seo = inject(Seo);
  private readonly storage = inject(BrowserStorage);

  protected readonly maxQty = MAX_QUANTITY;
  protected readonly preview = signal(false);
  protected readonly sent = signal(false);
  /** Remembered only in this browser so returning customers don't retype; never sent to the server except as an optional inquiry log. */
  protected customer: CustomerDetails = this.storage.get<CustomerDetails>(CUSTOMER_KEY, {});
  protected readonly hasNumber = computed(() => !!this.settings.settings().whatsapp_number);

  protected readonly message = () => {
    const s = this.settings.settings();
    return buildOrderMessage({
      template: s.message_template, siteName: s.site_name, currencySymbol: s.currency_symbol,
      origin: this.seo.siteOrigin(), lines: this.cart.lines(), customer: this.customer,
    });
  };

  constructor() {
    this.seo.set({ title: 'Cart', path: '/cart', noindex: true });
  }

  protected checkout(event: Event): void {
    event.preventDefault();
    const s = this.settings.settings();
    if (!s.whatsapp_number || this.cart.isEmpty()) return;
    this.storage.set(CUSTOMER_KEY, this.customer);
    if (s.log_inquiries) {
      const items = this.cart.lines().map((l) => ({
        product_id: l.productId, slug: l.slug, sku: l.sku, name: l.name, variant: l.variant, quantity: l.quantity, unit_price: l.unitPrice,
      }));
      this.api.logInquiry(items, this.customer, 'cart').pipe(catchError(() => of(null))).subscribe();
    }
    window.open(buildWhatsAppUrl(s.whatsapp_number, this.message()), '_blank', 'noopener');
    this.sent.set(true);
  }

  protected clear(): void {
    this.cart.clear();
    this.sent.set(false);
  }
}
