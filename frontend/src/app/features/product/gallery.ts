import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';

import { ProductImage } from '../../core/models';
import { Icon } from '../../shared/ui/icon';

const ZOOM_SCALE = 2.2;

@Component({
  selector: 'app-gallery',
  imports: [NgOptimizedImage, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-3 md:flex-row-reverse">
      <div class="relative aspect-square flex-1 cursor-zoom-in overflow-hidden rounded-lg bg-gray-100"
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
        <ul class="flex gap-2 overflow-x-auto md:max-h-[34rem] md:w-20 md:flex-col md:overflow-y-auto" aria-label="Product images">
          @for (img of images(); track img.id; let i = $index) {
            <li class="shrink-0">
              <button type="button" (click)="index.set(i)" [attr.aria-label]="'Show image ' + (i + 1)" [attr.aria-current]="i === index()"
                      class="relative block h-16 w-16 overflow-hidden rounded border-2 md:h-20 md:w-20"
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
           aria-label="Image viewer" (keydown.escape)="lightbox.set(false)" (click)="lightbox.set(false)">
        <button type="button" class="absolute right-4 top-4 text-white" aria-label="Close" (click)="lightbox.set(false)"><app-icon name="close" [size]="32" /></button>
        @if (images().length > 1) {
          <button type="button" class="absolute left-4 rotate-180 text-white" aria-label="Previous image" (click)="step(-1, $event)"><app-icon name="chevron" [size]="36" /></button>
          <button type="button" class="absolute right-4 text-white" aria-label="Next image" (click)="step(1, $event)"><app-icon name="chevron" [size]="36" /></button>
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

  protected step(delta: number, event: Event): void {
    event.stopPropagation();
    const n = this.images().length;
    this.index.update((i) => (i + delta + n) % n);
  }
}
