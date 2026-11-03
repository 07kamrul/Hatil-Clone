import { DatePipe, NgOptimizedImage, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { OperatorFunction, catchError, forkJoin, map, of } from 'rxjs';

import { Api } from '../../core/api';
import { Banner, BlogSummary, Faq, ProductCard, Showroom } from '../../core/models';
import { Seo } from '../../core/seo';
import { SettingsStore } from '../../core/settings-store';
import { Icon } from '../../shared/ui/icon';
import { ProductCardView } from '../../shared/ui/product-card';

const SLIDE_MS = 6000;
const PRODUCTS_PER_ROW = 8;

interface HomeData {
  hero: Banner[];
  offers: Banner[];
  categories: { id: number; name: string; slug: string; image: string | null }[];
  newest: ProductCard[];
  bestSellers: ProductCard[];
  featured: ProductCard[];
  showrooms: Showroom[];
  posts: BlogSummary[];
  faqs: Faq[];
}

const safe = <T>(fallback: T): OperatorFunction<T, T> => catchError(() => of(fallback));

@Component({
  selector: 'app-home',
  imports: [RouterLink, DatePipe, NgOptimizedImage, NgTemplateOutlet, ProductCardView, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (data.value(); as d) {
      <!-- Hero slider -->
      @if (d.hero.length) {
        <section class="relative overflow-hidden bg-gray-100" aria-roledescription="carousel" aria-label="Featured offers">
          <div class="relative aspect-[16/9] max-h-[560px] w-full sm:aspect-[16/6]">
            @for (b of d.hero; track b.id; let i = $index) {
              <div class="absolute inset-0 transition-opacity duration-700" [class.opacity-0]="i !== slide()"
                   [class.pointer-events-none]="i !== slide()" [attr.aria-hidden]="i !== slide()">
                <img [ngSrc]="b.image" [alt]="b.title" fill [priority]="i === 0" sizes="100vw" class="object-cover" />
                <div class="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent"></div>
                <div class="container-x absolute inset-0 flex flex-col justify-center text-white">
                  <h2 class="max-w-xl text-3xl font-bold sm:text-5xl">{{ b.title }}</h2>
                  @if (b.subtitle) { <p class="mt-2 max-w-md text-lg">{{ b.subtitle }}</p> }
                  @if (b.link_url) {
                    <a [routerLink]="b.link_url" class="btn-primary mt-5 w-fit" [attr.tabindex]="i === slide() ? 0 : -1">
                      {{ b.button_text || 'Shop now' }}</a>
                  }
                </div>
              </div>
            }
          </div>
          @if (d.hero.length > 1) {
            <div class="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
              @for (b of d.hero; track b.id; let i = $index) {
                <button type="button" (click)="goTo(i)" [attr.aria-label]="'Show slide ' + (i + 1)"
                        class="h-2.5 w-2.5 rounded-full" [class]="i === slide() ? 'bg-white' : 'bg-white/50'"></button>
              }
            </div>
            <button type="button" (click)="step(d.hero.length, -1)" aria-label="Previous slide"
                    class="absolute left-3 top-1/2 hidden -translate-y-1/2 rotate-180 rounded-full bg-white/80 p-2 sm:block"><app-icon name="chevron" /></button>
            <button type="button" (click)="step(d.hero.length, 1)" aria-label="Next slide"
                    class="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/80 p-2 sm:block"><app-icon name="chevron" /></button>
          }
        </section>
      }

      <!-- Featured categories -->
      @if (d.categories.length) {
        <section class="container-x py-10">
          <h2 class="section-title">Shop by category</h2>
          <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            @for (c of d.categories; track c.id) {
              <a [routerLink]="['/category', c.slug]" class="group relative block aspect-[4/3] overflow-hidden rounded-lg bg-gray-200">
                @if (c.image) { <img [ngSrc]="c.image" [alt]="c.name" fill sizes="(min-width:1024px) 25vw, 50vw" class="object-cover transition duration-300 group-hover:scale-105" /> }
                <span class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 font-semibold text-white">{{ c.name }}</span>
              </a>
            }
          </div>
        </section>
      }

      @if (d.newest.length) { <ng-container [ngTemplateOutlet]="row" [ngTemplateOutletContext]="{ title: 'New arrivals', items: d.newest, link: '/products', query: { sort: 'new' } }" /> }

      <!-- Offers -->
      @if (d.offers.length) {
        <section class="container-x grid gap-4 py-6 sm:grid-cols-2">
          @for (b of d.offers; track b.id) {
            <a [routerLink]="b.link_url || '/products'" class="group relative block aspect-[2/1] overflow-hidden rounded-lg bg-gray-200">
              <img [ngSrc]="b.image" [alt]="b.title" fill sizes="(min-width:640px) 50vw, 100vw" class="object-cover transition duration-300 group-hover:scale-105" />
              <div class="absolute inset-0 flex flex-col justify-center bg-black/35 p-6 text-white">
                <h3 class="text-2xl font-bold">{{ b.title }}</h3>
                @if (b.subtitle) { <p>{{ b.subtitle }}</p> }
                <span class="mt-2 underline">{{ b.button_text || 'Shop now' }}</span>
              </div>
            </a>
          }
        </section>
      }

      @if (d.bestSellers.length) { <ng-container [ngTemplateOutlet]="row" [ngTemplateOutletContext]="{ title: 'Best sellers', items: d.bestSellers, link: '/products', query: { sort: 'popular' } }" /> }
      @if (d.featured.length) { <ng-container [ngTemplateOutlet]="row" [ngTemplateOutletContext]="{ title: 'Featured', items: d.featured, link: '/products', query: { featured: true } }" /> }

      <!-- Showroom teaser -->
      @if (d.showrooms.length) {
        <section class="bg-gray-50 py-12">
          <div class="container-x">
            <h2 class="section-title">Visit a showroom</h2>
            <p class="mb-6 max-w-2xl text-gray-600">See and feel our furniture in person. Find a showroom near you.</p>
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              @for (s of d.showrooms; track s.id) {
                <a [routerLink]="['/showrooms', s.slug]" class="card flex gap-3 p-4 hover:shadow-md">
                  <app-icon name="pin" class="text-brand" />
                  <span><strong class="block">{{ s.name }}</strong><span class="text-sm text-gray-600">{{ s.address }}</span></span>
                </a>
              }
            </div>
            <a routerLink="/showrooms" class="btn-primary mt-6">All showrooms</a>
          </div>
        </section>
      }

      <!-- Blog teaser -->
      @if (d.posts.length) {
        <section class="container-x py-12">
          <h2 class="section-title">Inspiration</h2>
          <div class="grid gap-6 md:grid-cols-3">
            @for (p of d.posts; track p.id) {
              <a [routerLink]="['/blog', p.slug]" class="group block">
                <div class="relative aspect-[16/10] overflow-hidden rounded-lg bg-gray-200">
                  @if (p.cover_image) { <img [ngSrc]="p.cover_image" [alt]="p.title" fill sizes="(min-width:768px) 33vw, 100vw" class="object-cover transition duration-300 group-hover:scale-105" /> }
                </div>
                <h3 class="mt-3 font-semibold group-hover:text-brand">{{ p.title }}</h3>
                <p class="text-xs text-gray-500">{{ p.published_at | date: 'mediumDate' }}</p>
              </a>
            }
          </div>
        </section>
      }

      <!-- FAQ -->
      @if (d.faqs.length) {
        <section class="container-x max-w-3xl py-8">
          <h2 class="section-title">Frequently asked questions</h2>
          @for (f of d.faqs; track f.id) {
            <details class="mb-2 rounded-md border p-3"><summary class="cursor-pointer font-medium">{{ f.question }}</summary>
              <div class="prose-content mt-2 text-sm text-gray-700" [innerHTML]="f.answer_html"></div></details>
          }
        </section>
      }

      <!-- WhatsApp CTA -->
      <section class="bg-brand py-12 text-center text-white">
        <div class="container-x">
          <h2 class="text-2xl font-bold sm:text-3xl">Need help choosing?</h2>
          <p class="mx-auto mt-2 max-w-xl">Message us on WhatsApp for prices, availability and delivery. We reply fast.</p>
          <a [href]="settings.whatsappLink()" target="_blank" rel="noopener noreferrer" class="btn-whatsapp mt-5">
            <app-icon name="whatsapp" /> Chat on WhatsApp</a>
        </div>
      </section>
    } @else if (data.isLoading()) {
      <div class="container-x py-24 text-center text-gray-500">Loading…</div>
    }

    <ng-template #row let-title="title" let-items="items" let-link="link" let-query="query">
      <section class="container-x py-8">
        <div class="mb-4 flex items-end justify-between">
          <h2 class="section-title !mb-0">{{ title }}</h2>
          <a [routerLink]="link" [queryParams]="query" class="text-sm font-medium text-brand hover:underline">View all</a>
        </div>
        <div class="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          @for (p of items; track p.id) { <app-product-card [product]="p" /> }
        </div>
      </section>
    </ng-template>
  `,
  styles: `.section-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 1.25rem; }`,
})
export class Home {
  private readonly api = inject(Api);
  private readonly seo = inject(Seo);
  protected readonly settings = inject(SettingsStore);
  protected readonly slide = signal(0);
  private readonly slideCount = computed(() => this.data.value()?.hero.length ?? 0);

  protected readonly data = rxResource<HomeData, void>({
    stream: () =>
      forkJoin({
        hero: this.api.banners('hero').pipe(safe<Banner[]>([])),
        offers: this.api.banners('offer').pipe(safe<Banner[]>([])),
        categories: this.api.featuredCategories(8).pipe(safe<HomeData['categories']>([])),
        newest: this.api.products({ sort: 'new', page_size: PRODUCTS_PER_ROW }).pipe(catchError(() => of({ items: [] as ProductCard[] }))),
        bestSellers: this.api.products({ best_seller: true, sort: 'popular', page_size: PRODUCTS_PER_ROW }).pipe(catchError(() => of({ items: [] as ProductCard[] }))),
        featured: this.api.products({ featured: true, page_size: PRODUCTS_PER_ROW }).pipe(catchError(() => of({ items: [] as ProductCard[] }))),
        showrooms: this.api.showrooms().pipe(safe<Showroom[]>([])),
        posts: this.api.blog(1, 3).pipe(catchError(() => of({ items: [] as BlogSummary[] }))),
        faqs: this.api.faqs(true).pipe(safe<Faq[]>([])),
      }).pipe(
        map((r) => ({
          ...r, newest: r.newest.items, bestSellers: r.bestSellers.items, featured: r.featured.items,
          showrooms: r.showrooms.slice(0, 3), posts: r.posts.items,
        })),
      ),
  });

  constructor() {
    const s = this.settings.settings();
    this.seo.set({ title: s.site_name, description: s.meta_description, path: '/', jsonLd: {
      '@context': 'https://schema.org', '@type': 'Organization', name: s.site_name, url: this.seo.absolute('/'),
      logo: s.logo_url ? this.seo.absolute(s.logo_url) : undefined, telephone: s.hotline,
    } });
    effect((onCleanup) => {
      const count = this.slideCount();
      if (count < 2 || typeof window === 'undefined') return;
      const timer = setInterval(() => this.step(count, 1), SLIDE_MS);
      onCleanup(() => clearInterval(timer));
    });
  }

  protected goTo(i: number): void { this.slide.set(i); }
  protected step(count: number, delta: number): void { this.slide.update((i) => (i + delta + count) % count); }
}
