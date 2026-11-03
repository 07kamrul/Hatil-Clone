import { TestBed } from '@angular/core/testing';

import { CartStore, MAX_QUANTITY } from './cart-store';
import { CompareStore, MAX_COMPARE, RecentStore, WishlistStore } from './lists';

const item = (productId: number, variant: string | null = null, unitPrice = 1000) => ({
  productId, slug: `p-${productId}`, sku: `SKU-${productId}`, name: `Product ${productId}`, image: null, variant, unitPrice,
});

describe('CartStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('adds items and merges the same product + variant', () => {
    const cart = TestBed.inject(CartStore);
    cart.add(item(1, 'Walnut'));
    cart.add({ ...item(1, 'Walnut'), quantity: 2 });
    cart.add(item(1, 'Grey'));
    expect(cart.lines().length).toBe(2);
    expect(cart.count()).toBe(4);
  });

  it('computes the total from unit price and quantity', () => {
    const cart = TestBed.inject(CartStore);
    cart.add({ ...item(1, null, 2500), quantity: 3 });
    cart.add(item(2, null, 500));
    expect(cart.total()).toBe(8000);
  });

  it('updates, bounds and removes quantities', () => {
    const cart = TestBed.inject(CartStore);
    cart.add(item(1));
    const key = cart.lines()[0].key;
    cart.setQuantity(key, 5);
    expect(cart.count()).toBe(5);
    cart.setQuantity(key, 5000);
    expect(cart.count()).toBe(MAX_QUANTITY);
    cart.setQuantity(key, 0);
    expect(cart.isEmpty()).toBe(true);
  });

  it('persists to localStorage and restores on creation', async () => {
    const first = TestBed.inject(CartStore);
    first.add(item(7, 'Oak'));
    TestBed.tick();
    expect(JSON.parse(localStorage.getItem('cart.v1') ?? '[]')).toHaveLength(1);

    TestBed.resetTestingModule();
    const second = TestBed.inject(CartStore);
    expect(second.lines()[0].productId).toBe(7);
  });

  it('ignores corrupt stored data', () => {
    localStorage.setItem('cart.v1', '{not json');
    expect(TestBed.inject(CartStore).isEmpty()).toBe(true);
    TestBed.resetTestingModule();
    localStorage.setItem('cart.v1', JSON.stringify([{ nope: true }, null]));
    expect(TestBed.inject(CartStore).isEmpty()).toBe(true);
  });

  it('clears the cart', () => {
    const cart = TestBed.inject(CartStore);
    cart.add(item(1));
    cart.clear();
    expect(cart.count()).toBe(0);
  });
});

describe('list stores', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('toggles the wishlist', () => {
    const wishlist = TestBed.inject(WishlistStore);
    wishlist.toggle(3);
    expect(wishlist.has(3)).toBe(true);
    wishlist.toggle(3);
    expect(wishlist.has(3)).toBe(false);
  });

  it('caps the compare list', () => {
    const compare = TestBed.inject(CompareStore);
    for (let id = 1; id <= MAX_COMPARE; id++) expect(compare.toggle(id)).toBe(true);
    expect(compare.toggle(99)).toBe(false);
    expect(compare.count()).toBe(MAX_COMPARE);
  });

  it('keeps recently viewed unique, newest first', () => {
    const recent = TestBed.inject(RecentStore);
    [1, 2, 3, 2].forEach((id) => recent.push(id));
    expect(recent.ids()).toEqual([2, 3, 1]);
  });
});
