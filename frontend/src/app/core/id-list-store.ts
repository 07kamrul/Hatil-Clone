import { computed, effect, inject, signal } from '@angular/core';

import { BrowserStorage } from './browser-storage';

/** Base for localStorage-backed lists of product ids (wishlist, compare, recently viewed). */
export abstract class IdListStore {
  private readonly storage = inject(BrowserStorage);
  private readonly state = signal<readonly number[]>([]);

  readonly ids = this.state.asReadonly();
  readonly count = computed(() => this.state().length);

  protected constructor(private readonly key: string, private readonly limit: number) {
    const stored = this.storage.get<unknown[]>(key, []);
    this.state.set(Array.isArray(stored) ? stored.filter((x): x is number => Number.isInteger(x)).slice(0, limit) : []);
    effect(() => this.storage.set(this.key, this.state()));
  }

  has(id: number): boolean {
    return this.state().includes(id);
  }

  protected addFirst(id: number): void {
    this.state.update((ids) => [id, ...ids.filter((x) => x !== id)].slice(0, this.limit));
  }

  protected addLast(id: number): boolean {
    if (this.state().includes(id)) return true;
    if (this.state().length >= this.limit) return false;
    this.state.update((ids) => [...ids, id]);
    return true;
  }

  remove(id: number): void {
    this.state.update((ids) => ids.filter((x) => x !== id));
  }

  clear(): void {
    this.state.set([]);
  }
}
