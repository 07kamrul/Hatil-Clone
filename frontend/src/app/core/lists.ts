import { Injectable } from '@angular/core';

import { IdListStore } from './id-list-store';

export const MAX_WISHLIST = 100;
export const MAX_COMPARE = 4;
export const MAX_RECENT = 12;

@Injectable({ providedIn: 'root' })
export class WishlistStore extends IdListStore {
  constructor() {
    super('wishlist.v1', MAX_WISHLIST);
  }

  toggle(id: number): void {
    if (this.has(id)) this.remove(id);
    else this.addFirst(id);
  }
}

@Injectable({ providedIn: 'root' })
export class CompareStore extends IdListStore {
  constructor() {
    super('compare.v1', MAX_COMPARE);
  }

  /** Returns false when the list is full and the product was not added. */
  toggle(id: number): boolean {
    if (this.has(id)) {
      this.remove(id);
      return true;
    }
    return this.addLast(id);
  }
}

@Injectable({ providedIn: 'root' })
export class RecentStore extends IdListStore {
  constructor() {
    super('recent.v1', MAX_RECENT);
  }

  push(id: number): void {
    this.addFirst(id);
  }
}
