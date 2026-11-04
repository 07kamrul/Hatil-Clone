import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Banner } from '../../core/models';

const SLIDE_MS = 6000;
const SWIPE_MIN_PX = 50;

/** Full-bleed hero carousel: slides move side by side (hatil.com style), with arrows, dots, swipe and hover-pause. */
@Component({
  selector: 'app-home-hero',
  imports: [RouterLink, NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hero group relative overflow-hidden bg-neutral-900" aria-roledescription="carousel" aria-label="Featured collections"
             (mouseenter)="paused.set(true)" (mouseleave)="paused.set(false)"
             (touchstart)="onTouchStart($event)" (touchend)="onTouchEnd($event)">
      <div class="flex h-full transition-transform duration-700 ease-in-out" [style.transform]="'translateX(-' + slide() * 100 + '%)'">
        @for (b of slides(); track b.id; let i = $index) {
          <div class="relative h-full w-full shrink-0" [class.bg-[#fdf6e9]]="!b.title"
               [attr.aria-hidden]="i !== slide()" aria-roledescription="slide">
            @if (b.image) {
              <img [ngSrc]="b.image" [alt]="b.title || 'Featured'" fill [priority]="i === 0" sizes="100vw"
                   [class.object-cover]="!!b.title" [class.object-contain]="!b.title" />
            }
            @if (!b.title) {
              <!-- Designed artwork (e.g. a Facebook cover) carries its own text: no overlay, the whole slide links. -->
              @if (b.link_url) {
                <a [routerLink]="b.link_url" [attr.tabindex]="i === slide() ? 0 : -1"
                   [attr.aria-label]="b.button_text || 'Explore'" class="absolute inset-0"></a>
              }
            } @else {
              <div class="absolute inset-0 bg-black/45"></div>
              <div class="absolute inset-0 flex items-center">
                <div class="mx-auto w-full max-w-6xl px-6 text-white sm:px-10">
                  <h2 class="hero-title">
                    <span>{{ b.title }}</span><span class="hero-line hidden md:inline-block"></span>
                  </h2>
                  @if (b.subtitle) {
                    <p class="hero-sub mt-4 sm:mt-8">
                      <span class="hero-line hidden md:inline-block"></span><span>{{ b.subtitle }}</span>
                    </p>
                  }
                  @if (b.link_url) {
                    <a [routerLink]="b.link_url" [attr.tabindex]="i === slide() ? 0 : -1"
                       class="mt-8 inline-flex items-center gap-2 border border-white/80 px-7 py-3 text-sm font-medium uppercase tracking-[.2em] transition hover:bg-white hover:text-gray-900">
                      {{ b.button_text || 'Explore' }}</a>
                  }
                </div>
              </div>
            }
          </div>
        }
      </div>
      @if (slides().length > 1) {
        <button type="button" (click)="prev()" aria-label="Previous slide"
                class="hero-arrow left-4 opacity-0 group-hover:opacity-100 focus-visible:opacity-100">&#8249;</button>
        <button type="button" (click)="next()" aria-label="Next slide"
                class="hero-arrow right-4 opacity-0 group-hover:opacity-100 focus-visible:opacity-100">&#8250;</button>
        <div class="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-1">
          @for (b of slides(); track b.id; let i = $index) {
            <button type="button" (click)="go(i)" [attr.aria-label]="'Show slide ' + (i + 1)"
                    [attr.aria-current]="i === slide()" class="flex h-7 w-7 items-center justify-center">
              <span class="rounded-full transition-all" [class]="i === slide() ? 'h-3.5 w-3.5 bg-white' : 'h-3 w-3 bg-white/40'"></span>
            </button>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .hero { height: calc(100svh - var(--header-h, 88px)); min-height: 460px; max-height: 1000px; }
    .hero-title { display: flex; align-items: center; gap: 1.5rem; font-weight: 700; line-height: 1.05;
      font-size: clamp(2.5rem, 6.5vw, 6rem); letter-spacing: -.01em; }
    .hero-sub { display: flex; align-items: center; justify-content: flex-end; gap: 1.5rem; font-weight: 300;
      font-size: clamp(1.6rem, 4.5vw, 4.25rem); line-height: 1.1; }
    .hero-line { flex: 0 0 auto; width: clamp(6rem, 14vw, 15rem); height: 1px; background: rgba(255,255,255,.85); }
    .hero-arrow { position: absolute; top: 50%; z-index: 10; transform: translateY(-50%); display: flex; width: 3rem; height: 3rem;
      align-items: center; justify-content: center; border-radius: 9999px; background: rgba(0,0,0,.35); color: #fff;
      font-size: 2rem; line-height: 1; transition: opacity .3s, background .3s; }
    .hero-arrow:hover { background: rgba(0,0,0,.6); }
  `,
})
export class HomeHero {
  readonly slides = input.required<Banner[]>();
  protected readonly slide = signal(0);
  protected readonly paused = signal(false);
  /** Bumped on manual navigation so the autoplay timer restarts. */
  private readonly tick = signal(0);
  private touchX = 0;

  constructor() {
    effect((onCleanup) => {
      const count = this.slides().length;
      this.tick();
      if (count < 2 || this.paused() || typeof window === 'undefined') return;
      const timer = setInterval(() => this.slide.update((i) => (i + 1) % count), SLIDE_MS);
      onCleanup(() => clearInterval(timer));
    });
  }

  protected go(i: number): void {
    const count = this.slides().length;
    this.slide.set(((i % count) + count) % count);
    this.tick.update((t) => t + 1);
  }

  protected next(): void { this.go(this.slide() + 1); }
  protected prev(): void { this.go(this.slide() - 1); }

  protected onTouchStart(e: TouchEvent): void { this.touchX = e.touches[0]?.clientX ?? 0; }

  protected onTouchEnd(e: TouchEvent): void {
    const dx = (e.changedTouches[0]?.clientX ?? this.touchX) - this.touchX;
    if (Math.abs(dx) < SWIPE_MIN_PX) return;
    if (dx < 0) this.next(); else this.prev();
  }
}
