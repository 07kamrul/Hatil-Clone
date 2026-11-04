import { DatePipe, NgOptimizedImage, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { OperatorFunction, catchError, forkJoin, map, of } from 'rxjs';

import { Api } from '../../core/api';
import { Banner, BlogSummary, Faq, ProductCard, Showroom } from '../../core/models';
import { Seo } from '../../core/seo';
import { SettingsStore } from '../../core/settings-store';
import { Icon } from '../../shared/ui/icon';
import { ProductCardView } from '../../shared/ui/product-card';
import { HomeHero } from './home-hero';

const PRODUCTS_PER_ROW = 8;
const MIN_HERO_SLIDES = 5;

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
  imports: [RouterLink, DatePipe, NgOptimizedImage, NgTemplateOutlet, ProductCardView, Icon, HomeHero],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (data.value(); as d) {
      <!-- Hero slider -->
      @if (heroSlides().length) { <app-home-hero [slides]="heroSlides()" /> }

      <!-- Featured categories -->
      @if (d.categories.length) {
        <section class="py-14">
          <h2 class="section-title">Explore our collections</h2>
          <div class="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4">
            @for (c of d.categories; track c.id) {
              <a [routerLink]="['/category', c.slug]" class="group relative block aspect-square overflow-hidden bg-gray-200">
                @if (c.image) { <img [ngSrc]="c.image" [alt]="c.name" fill sizes="(min-width:1024px) 25vw, 50vw" class="object-cover transition duration-300 group-hover:scale-105" /> }
                <span class="absolute inset-0 bg-black/25 transition group-hover:bg-black/45"></span>
                <span class="absolute inset-0 flex flex-col items-center justify-center text-center text-white">
                  <span class="text-xl font-semibold tracking-wide sm:text-3xl">{{ c.name }}</span>
                  <span class="mt-2 h-px w-10 bg-white transition-all duration-300 group-hover:w-20"></span>
                </span>
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
            <a [routerLink]="b.link_url || '/products'" class="group relative block aspect-[2/1] overflow-hidden bg-gray-200">
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
                <div class="relative aspect-[16/10] overflow-hidden bg-gray-200">
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
      <section class="container-x py-12">
        <h2 class="section-title">{{ title }}</h2>
        <div class="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          @for (p of items; track p.id) { <app-product-card [product]="p" /> }
        </div>
        <div class="mt-8 text-center">
          <a [routerLink]="link" [queryParams]="query" class="inline-block border border-gray-900 px-8 py-3 text-sm font-medium uppercase tracking-[.2em] transition hover:bg-gray-900 hover:text-white">View all</a>
        </div>
      </section>
    </ng-template>
  `,
  styles: `.section-title { text-align: center; font-size: clamp(1.75rem, 3vw, 2.5rem); font-weight: 600; margin-bottom: 2rem; }
    .section-title::after { content: ''; display: block; width: 4rem; height: 2px; margin: .75rem auto 0; background: var(--color-brand); }`,
})
export class Home {
  private readonly api = inject(Api);
  private readonly seo = inject(Seo);
  protected readonly settings = inject(SettingsStore);

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
  }

  /** Hero banners; slides without an image borrow a category photo so the hero never renders empty. */
  protected readonly heroSlides = computed(() => {
    const d = this.data.value();
    if (!d) return [];
    const photos = d.categories.map((c) => c.image).filter((img): img is string => !!img);
    const hero = d.hero.map((b, i) => (b.image || !photos.length ? b : { ...b, image: photos[i % photos.length] }));
    if (hero.length >= MIN_HERO_SLIDES) return hero;
    // Too few banners for a carousel: top up with category slides so the hero keeps sliding.
    const extra: Banner[] = d.categories
      .filter((c) => !!c.image)
      .slice(0, MIN_HERO_SLIDES + 1 - hero.length)
      .map((c, i) => ({
        id: -(c.id || i + 1), title: c.name, subtitle: 'Explore the collection', image: c.image as string,
        mobile_image: null, link_url: `/category/${c.slug}`, button_text: 'Shop now',
        placement: 'hero', sort_order: 1000 + i, is_active: true,
      }));
    return [...hero, ...extra];
  });
}
