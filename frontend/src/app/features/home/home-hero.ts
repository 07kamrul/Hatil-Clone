import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Banner } from '../../core/models';

const SLIDE_MS = 6000;

/** Full-bleed, full-height hero carousel with large editorial typography. */
@Component({
  selector: 'app-home-hero',
  imports: [RouterLink, NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hero relative overflow-hidden bg-neutral-900" aria-roledescription="carousel" aria-label="Featured collections">
      @for (b of slides(); track b.id; let i = $index) {
        <div class="absolute inset-0 transition-opacity duration-1000" [class.opacity-0]="i !== slide()" [class.bg-[#fdf6e9]]="!b.title"
             [attr.aria-hidden]="i !== slide()" aria-roledescription="slide">
          @if (b.image) {
            <img [ngSrc]="b.image" [alt]="b.title || 'Featured'" fill [priority]="i === 0" sizes="100vw"
                 class="transition-transform duration-[7000ms] ease-out" [class.object-cover]="!!b.title"
                 [class.object-contain]="!b.title" [class.scale-105]="!!b.title && i === slide()" />
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
      @if (slides().length > 1) {
        <div class="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-1">
          @for (b of slides(); track b.id; let i = $index) {
            <button type="button" (click)="slide.set(i)" [attr.aria-label]="'Show slide ' + (i + 1)"
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
  `,
})
export class HomeHero {
  readonly slides = input.required<Banner[]>();
  protected readonly slide = signal(0);

  constructor() {
    effect((onCleanup) => {
      const count = this.slides().length;
      if (count < 2 || typeof window === 'undefined') return;
      const timer = setInterval(() => this.slide.update((i) => (i + 1) % count), SLIDE_MS);
      onCleanup(() => clearInterval(timer));
    });
  }
}
