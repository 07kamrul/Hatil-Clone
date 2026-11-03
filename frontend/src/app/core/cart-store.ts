import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { BrowserStorage } from './browser-storage';
import { CartLine, cartTotal, lineKey } from './whatsapp';

const STORAGE_KEY = 'cart.v1';
export const MAX_QUANTITY = 99;

export interface NewCartLine {
  productId: number;
  slug: string;
  sku: string;
  name: string;
  image: string | null;
  variant: string | null;
  unitPrice: number;
  quantity?: number;
}

function isCartLine(value: unknown): value is CartLine {
  const v = value as Partial<CartLine> | null;
  return !!v && typeof v.key === 'string' && typeof v.productId === 'number'
    && typeof v.unitPrice === 'number' && typeof v.quantity === 'number' && typeof v.name === 'string';
}

@Injectable({ providedIn: 'root' })
export class CartStore {
  private readonly storage = inject(BrowserStorage);
  private readonly state = signal<readonly CartLine[]>([]);

  readonly lines = this.state.asReadonly();
  readonly count = computed(() => this.state().reduce((n, l) => n + l.quantity, 0));
  readonly total = computed(() => cartTotal(this.state()));
  readonly isEmpty = computed(() => this.state().length === 0);

  constructor() {
    const stored = this.storage.get<unknown[]>(STORAGE_KEY, []);
    this.state.set(Array.isArray(stored) ? stored.filter(isCartLine) : []);
    effect(() => this.storage.set(STORAGE_KEY, this.state()));
  }

  add(item: NewCartLine): void {
    const key = lineKey(item.productId, item.variant);
    const quantity = Math.max(1, item.quantity ?? 1);
    const existing = this.state().find((l) => l.key === key);
    if (existing) {
      this.setQuantity(key, existing.quantity + quantity);
      return;
    }
    this.state.update((lines) => [
      ...lines,
      { key, productId: item.productId, slug: item.slug, sku: item.sku, name: item.name, image: item.image,
        variant: item.variant, unitPrice: item.unitPrice, quantity: Math.min(quantity, MAX_QUANTITY) },
    ]);
  }

  setQuantity(key: string, quantity: number): void {
    if (quantity < 1) {
      this.remove(key);
      return;
    }
    const bounded = Math.min(Math.floor(quantity), MAX_QUANTITY);
    this.state.update((lines) => lines.map((l) => (l.key === key ? { ...l, quantity: bounded } : l)));
  }

  remove(key: string): void {
    this.state.update((lines) => lines.filter((l) => l.key !== key));
  }

  clear(): void {
    this.state.set([]);
  }
}
