import { DatePipe, NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  HostListener,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { Api } from '../../core/api';
import { BlogPost, BlogSummary } from '../../core/models';
import { Seo } from '../../core/seo';
import { SettingsStore } from '../../core/settings-store';
import { Breadcrumbs } from '../../shared/ui/breadcrumbs';

/** Wraps the lightbox index within [0, count); count 0 or less returns null. */
export function wrapIndex(current: number, delta: number, count: number): number | null {
  if (count <= 0) return null;
  return (current + delta + count) % count;
}

@Component({
  selector: 'app-blog-detail',
  imports: [RouterLink, DatePipe, NgOptimizedImage, Breadcrumbs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (data.value(); as d) {
      <app-breadcrumbs
        [crumbs]="[{ label: 'Inspiration', link: ['/blog'] }, { label: d.post.title }]"
      />
      <article class="container-x max-w-3xl pb-12">
        <h1 class="h-1 leading-tight break-words">{{ d.post.title }}</h1>
        <p class="mt-2 text-sm text-gray-500">
          {{ d.post.published_at | date: 'longDate' }}
          @if (d.post.author) {
            · {{ d.post.author }}
          }
        </p>
        @if (d.post.cover_image) {
          <div class="relative mt-6 aspect-[16/9] overflow-hidden rounded-lg">
            <img
              [ngSrc]="d.post.cover_image"
              [alt]="d.post.title"
              fill
              priority
              sizes="(min-width:768px) 60vw, 100vw"
              class="object-cover"
            />
          </div>
        }
        <div class="prose-content mt-6 max-w-prose break-words [&_img]:h-auto [&_img]:max-w-full [&_iframe]:max-w-full [&_table]:block [&_table]:overflow-x-auto" [innerHTML]="d.post.body_html"></div>
        @if (gallery().length) {
          <section class="mt-6" aria-label="Post photos">
            <h2 class="mb-3 text-lg font-semibold">Photos</h2>
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
              @for (img of gallery(); track $index) {
                <button
                  type="button"
                  (click)="lightbox.set($index)"
                  class="group relative aspect-[4/3] overflow-hidden rounded-lg bg-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  [attr.aria-label]="'Open photo ' + ($index + 1)"
                >
                  <img
                    [ngSrc]="img"
                    [alt]="d.post.title + ' photo ' + ($index + 1)"
                    fill
                    sizes="(min-width:768px) 25vw, 50vw"
                    class="object-cover transition-transform group-hover:scale-105"
                  />
                </button>
              }
            </div>
          </section>
        }
      </article>
      @if (lightbox() !== null) {
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          (click)="lightbox.set(null)"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="d.post.title + ' photos'"
        >
          <button
            type="button"
            class="icon-btn absolute top-3 right-3 h-11 w-11 text-3xl leading-none text-white hover:bg-white/10"
            (click)="lightbox.set(null)"
            aria-label="Close"
          >
            ×
          </button>
          @if (gallery().length > 1) {
            <button
              type="button"
              class="icon-btn absolute left-2 h-11 w-11 text-4xl text-white hover:bg-white/10 sm:left-4"
              (click)="step(-1, $event)"
              aria-label="Previous photo"
            >
              ‹
            </button>
            <button
              type="button"
              class="icon-btn absolute right-2 h-11 w-11 text-4xl text-white hover:bg-white/10 sm:right-4"
              (click)="step(1, $event)"
              aria-label="Next photo"
            >
              ›
            </button>
          }
          <img
            [src]="gallery()[lightbox()!]"
            [alt]="d.post.title + ' photo ' + ((lightbox() ?? 0) + 1)"
            class="max-h-full max-w-full object-contain"
            (click)="$event.stopPropagation()"
          />
          <p class="absolute bottom-4 text-sm text-white/80">
            {{ (lightbox() ?? 0) + 1 }} / {{ gallery().length }}
          </p>
        </div>
      }
      @if (d.related.length) {
        <section class="container-x max-w-5xl border-t border-gray-200 pt-10 pb-12">
          <h2 class="h-3 mb-4">More inspiration</h2>
          <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            @for (r of d.related; track r.id) {
              <a [routerLink]="['/blog', r.slug]" class="group block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
                <div class="relative aspect-[16/10] overflow-hidden rounded-lg bg-gray-200">
                  @if (r.cover_image) {
                    <img
                      [ngSrc]="r.cover_image"
                      [alt]="r.title"
                      fill
                      sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
                      class="object-cover"
                    />
                  }
                </div>
                <h3 class="mt-2 font-medium group-hover:text-brand">{{ r.title }}</h3>
              </a>
            }
          </div>
        </section>
      }
    } @else if (data.isLoading()) {
      <div class="container-x max-w-3xl py-8" aria-busy="true" aria-label="Loading post">
        <div class="skeleton h-9 w-3/4"></div>
        <div class="skeleton mt-3 h-4 w-40"></div>
        <div class="skeleton mt-6 aspect-[16/9] rounded-lg"></div>
        <div class="skeleton mt-6 h-4 w-full"></div>
        <div class="skeleton mt-2 h-4 w-5/6"></div>
      </div>
    } @else {
      <div class="container-x empty-state my-16">
        <h1 class="h-2">Post not found</h1>
        <p class="text-muted mt-2">It may have been moved or unpublished.</p>
        <a routerLink="/blog" class="btn-primary mt-6">Back to blog</a>
      </div>
    }
  `,
})
export class BlogDetail {
  readonly slug = input.required<string>();
  private readonly api = inject(Api);
  private readonly seo = inject(Seo);
  private readonly settings = inject(SettingsStore);

  protected readonly data = rxResource<
    { post: BlogPost; related: BlogSummary[] } | undefined,
    string
  >({
    params: () => this.slug(),
    stream: ({ params }) =>
      this.api.blogPost(params).pipe(
        catchError(() => {
          this.seo.setStatus(404);
          return of(undefined);
        }),
      ),
  });

  protected readonly gallery = computed(() => this.data.value()?.post.gallery ?? []);
  protected readonly lightbox = signal<number | null>(null);

  @HostListener('document:keydown', ['$event'])
  protected onKey(event: KeyboardEvent): void {
    if (this.lightbox() === null) return;
    if (event.key === 'Escape') this.lightbox.set(null);
    else if (event.key === 'ArrowLeft') this.step(-1, event);
    else if (event.key === 'ArrowRight') this.step(1, event);
  }

  protected step(delta: number, event: Event): void {
    event.stopPropagation();
    const next = wrapIndex(this.lightbox() ?? 0, delta, this.gallery().length);
    if (next !== null) this.lightbox.set(next);
  }

  constructor() {
    effect(() => {
      const post = this.data.value()?.post;
      if (!post) return;
      this.seo.set({
        title: post.seo_title || post.title,
        description: post.seo_description || post.excerpt,
        image: post.cover_image,
        path: `/blog/${post.slug}`,
        type: 'article',
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          datePublished: post.published_at,
          image: post.cover_image ? this.seo.absolute(post.cover_image) : undefined,
          author: {
            '@type': 'Organization',
            name: post.author || this.settings.settings().site_name,
          },
          publisher: { '@type': 'Organization', name: this.settings.settings().site_name },
        },
      });
    });
  }
}
