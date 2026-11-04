import { DatePipe, NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
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
      <app-breadcrumbs [crumbs]="[{ label: 'Inspiration', link: ['/blog'] }, { label: d.post.title }]" />
      <article class="container-x max-w-3xl pb-10">
        <h1 class="text-3xl font-bold leading-tight">{{ d.post.title }}</h1>
        <p class="mt-2 text-sm text-gray-500">{{ d.post.published_at | date: 'longDate' }}@if (d.post.author) { · {{ d.post.author }} }</p>
        @if (d.post.cover_image) {
          <div class="relative mt-6 aspect-[16/9] overflow-hidden rounded-lg"><img [ngSrc]="d.post.cover_image" [alt]="d.post.title" fill priority sizes="(min-width:768px) 768px, 100vw" class="object-cover" /></div>
        }
        <div class="prose-content mt-6" [innerHTML]="d.post.body_html"></div>
        @if (gallery().length) {
          <section class="mt-6" aria-label="Post photos">
            <h2 class="mb-3 text-lg font-semibold">Photos</h2>
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
              @for (img of gallery(); track $index) {
                <button type="button" (click)="lightbox.set($index)" class="group relative aspect-[4/3] overflow-hidden rounded-lg bg-gray-200" [attr.aria-label]="'Open photo ' + ($index + 1)">
                  <img [ngSrc]="img" [alt]="d.post.title + ' photo ' + ($index + 1)" fill sizes="(min-width:768px) 250px, 50vw" class="object-cover transition-transform group-hover:scale-105" />
                </button>
              }
            </div>
          </section>
        }
      </article>
      @if (lightbox() !== null) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" (click)="lightbox.set(null)" role="dialog" aria-modal="true" [attr.aria-label]="d.post.title + ' photos'">
          <button type="button" class="absolute top-4 right-4 text-3xl leading-none text-white" (click)="lightbox.set(null)" aria-label="Close">×</button>
          @if (gallery().length > 1) {
            <button type="button" class="absolute left-4 text-4xl text-white" (click)="step(-1, $event)" aria-label="Previous photo">‹</button>
            <button type="button" class="absolute right-4 text-4xl text-white" (click)="step(1, $event)" aria-label="Next photo">›</button>
          }
          <img [src]="gallery()[lightbox()!]" [alt]="d.post.title + ' photo ' + ((lightbox() ?? 0) + 1)" class="max-h-full max-w-full object-contain" (click)="$event.stopPropagation()" />
          <p class="absolute bottom-4 text-sm text-white/80">{{ (lightbox() ?? 0) + 1 }} / {{ gallery().length }}</p>
        </div>
      }
      @if (d.related.length) {
        <section class="container-x max-w-5xl pb-10">
          <h2 class="mb-4 text-xl font-bold">More inspiration</h2>
          <div class="grid gap-6 sm:grid-cols-3">
            @for (r of d.related; track r.id) {
              <a [routerLink]="['/blog', r.slug]" class="group block">
                <div class="relative aspect-[16/10] overflow-hidden rounded-lg bg-gray-200">
                  @if (r.cover_image) { <img [ngSrc]="r.cover_image" [alt]="r.title" fill sizes="(min-width:640px) 33vw, 100vw" class="object-cover" /> }
                </div>
                <h3 class="mt-2 font-medium group-hover:text-brand">{{ r.title }}</h3>
              </a>
            }
          </div>
        </section>
      }
    } @else if (!data.isLoading()) {
      <div class="container-x py-24 text-center"><h1 class="text-2xl font-bold">Post not found</h1><a routerLink="/blog" class="btn-primary mt-6">Back to blog</a></div>
    }
  `,
})
export class BlogDetail {
  readonly slug = input.required<string>();
  private readonly api = inject(Api);
  private readonly seo = inject(Seo);
  private readonly settings = inject(SettingsStore);

  protected readonly data = rxResource<{ post: BlogPost; related: BlogSummary[] } | undefined, string>({
    params: () => this.slug(),
    stream: ({ params }) => this.api.blogPost(params).pipe(catchError(() => {
      this.seo.setStatus(404);
      return of(undefined);
    })),
  });

  protected readonly gallery = computed(() => this.data.value()?.post.gallery ?? []);
  protected readonly lightbox = signal<number | null>(null);

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
        title: post.seo_title || post.title, description: post.seo_description || post.excerpt, image: post.cover_image,
        path: `/blog/${post.slug}`, type: 'article',
        jsonLd: {
          '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.title, datePublished: post.published_at,
          image: post.cover_image ? this.seo.absolute(post.cover_image) : undefined,
          author: { '@type': 'Organization', name: post.author || this.settings.settings().site_name },
          publisher: { '@type': 'Organization', name: this.settings.settings().site_name },
        },
      });
    });
  }
}
