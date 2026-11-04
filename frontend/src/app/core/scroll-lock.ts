import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, PLATFORM_ID, Signal, effect, inject } from '@angular/core';

/** Active lock count per document, so stacked overlays don't release each other's lock. */
const lockCounts = new WeakMap<Document, number>();

function adjust(doc: Document, delta: 1 | -1): void {
  const next = Math.max(0, (lockCounts.get(doc) ?? 0) + delta);
  lockCounts.set(doc, next);
  doc.body.style.overflow = next > 0 ? 'hidden' : '';
}

/**
 * Locks page scroll while `active()` is true. Ref-counted across overlays (menu drawer,
 * dialogs, lightbox, filter drawer) and released on destroy. No-op during SSR.
 * Must be called in an injection context (e.g. a component constructor).
 */
export function useScrollLock(active: Signal<boolean>): void {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
  const doc = inject(DOCUMENT);
  let held = false;
  const set = (want: boolean): void => {
    if (want === held) return;
    held = want;
    adjust(doc, want ? 1 : -1);
  };
  effect(() => set(active()));
  inject(DestroyRef).onDestroy(() => set(false));
}
