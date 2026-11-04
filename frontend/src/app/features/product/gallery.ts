import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';

import { ProductImage } from '../../core/models';
import { Icon } from '../../shared/ui/icon';

const ZOOM_SCALE = 2.2;
/** Minimum horizontal travel (px) for a touch gesture to count as a swipe. */
const SWIPE_PX = 40;

@Component({
  selector: 'app-gallery',
  imports: [NgOptimizedImage, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-3 md:flex-row-reverse">
      <div class="relative min-w-0 flex-1">
      <div class="relative aspect-square cursor-zoom-in touch-pan-y overflow-hidden rounded-lg bg-gray-100 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
           (touchstart)="touchStart($event)" (touchend)="touchEnd($event)"
           (mousemove)="move($event)" (mouseenter)="zooming.set(true)" (mouseleave)="zooming.set(false)"
           (click)="lightbox.set(true)" role="button" tabindex="0" (keydown.enter)="lightbox.set(true)"
           aria-label="Open image in full screen">
        @if (current(); as img) {
          <img [ngSrc]="img.url" [alt]="img.alt || alt()" fill priority sizes="(min-width:768px) 50vw, 100vw"
               class="object-contain transition-transform duration-150"
               [style.transform]="zooming() ? 'scale(' + scale + ')' : 'none'" [style.transform-origin]="origin()" />
        } @else {
          <div class="flex h-full items-center justify-center text-gray-400">No image</div>
        }
      </div>
        @if (images().length > 1) {
          <button type="button" class="absolute left-2 top-1/2 flex size-11 -translate-y-1/2 rotate-180 items-center justify-center rounded-full bg-white/90 shadow md:hidden" aria-label="Previous image" (click)="step(-1, $event)"><app-icon name="chevron" [size]="20" /></button>
          <button type="button" class="absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow md:hidden" aria-label="Next image" (click)="step(1, $event)"><app-icon name="chevron" [size]="20" /></button>
          <span class="pill absolute bottom-2 right-2 bg-gray-900/70 text-white md:hidden" aria-live="polite">{{ index() + 1 }} / {{ images().length }}</span>
        }
      </div>
      @if (images().length > 1) {
        <ul class="scroll-x gap-2 md:max-h-[34rem] md:w-20 md:flex-col md:overflow-y-auto" aria-label="Product images">
          @for (img of images(); track img.id; let i = $index) {
            <li class="shrink-0">
              <button type="button" (click)="index.set(i)" [attr.aria-label]="'Show image ' + (i + 1)" [attr.aria-current]="i === index()"
                      class="relative block h-16 w-16 overflow-hidden rounded border-2 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none md:h-20 md:w-20"
                      [class]="i === index() ? 'border-brand' : 'border-transparent'">
                <img [ngSrc]="img.thumb_url || img.url" [alt]="img.alt || alt()" width="80" height="80" class="h-full w-full object-cover" />
              </button>
            </li>
          }
        </ul>
      }
    </div>

    @if (lightbox() && current(); as img) {
      <div class="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal="true"
           aria-label="Image viewer" (touchstart)="touchStart($event)" (touchend)="touchEnd($event)" (keydown.escape)="lightbox.set(false)" (click)="lightbox.set(false)">
        <button type="button" class="absolute right-2 top-2 z-10 flex size-12 items-center justify-center text-white" aria-label="Close" (click)="lightbox.set(false)"><app-icon name="close" [size]="32" /></button>
        @if (images().length > 1) {
          <button type="button" class="absolute left-1 z-10 flex size-12 rotate-180 items-center justify-center text-white sm:left-4" aria-label="Previous image" (click)="step(-1, $event)"><app-icon name="chevron" [size]="36" /></button>
          <button type="button" class="absolute right-1 z-10 flex size-12 items-center justify-center text-white sm:right-4" aria-label="Next image" (click)="step(1, $event)"><app-icon name="chevron" [size]="36" /></button>
        }
        <img [src]="img.url" [alt]="img.alt || alt()" class="max-h-full max-w-full object-contain" (click)="$event.stopPropagation()" />
      </div>
    }
  `,
})
export class Gallery {
  readonly images = input.required<ProductImage[]>();
  readonly alt = input('');

  protected readonly scale = ZOOM_SCALE;
  protected readonly index = signal(0);
  protected readonly zooming = signal(false);
  protected readonly lightbox = signal(false);
  protected readonly origin = signal('50% 50%');
  protected readonly current = computed(() => this.images()[this.index()] ?? null);

  constructor() {
    effect(() => {
      this.images();
      this.index.set(0);
    });
  }

  protected move(event: MouseEvent): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    this.origin.set(`${x.toFixed(1)}% ${y.toFixed(1)}%`);
  }

  private touchX: number | null = null;

  protected touchStart(event: TouchEvent): void {
    this.touchX = event.touches[0]?.clientX ?? null;
  }

  protected touchEnd(event: TouchEvent): void {
    const start = this.touchX;
    this.touchX = null;
    const end = event.changedTouches[0]?.clientX;
    if (start === null || end === undefined || this.images().length < 2) return;
    const dx = end - start;
    if (Math.abs(dx) >= SWIPE_PX) this.step(dx < 0 ? 1 : -1, event);
  }

  protected step(delta: number, event: Event): void {
    event.stopPropagation();
    const n = this.images().length;
    this.index.update((i) => (i + delta + n) % n);
  }
}
