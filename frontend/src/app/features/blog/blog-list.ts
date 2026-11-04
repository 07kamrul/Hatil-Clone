import { DatePipe, NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { Api } from '../../core/api';
import { Seo } from '../../core/seo';
import { Breadcrumbs } from '../../shared/ui/breadcrumbs';
import { Pagination } from '../../shared/ui/pagination';

const PAGE_SIZE = 9;

@Component({
  selector: 'app-blog-list',
  imports: [RouterLink, DatePipe, NgOptimizedImage, Breadcrumbs, Pagination],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-breadcrumbs [crumbs]="[{ label: 'Inspiration' }]" />
    <div class="container-x pb-12">
      <h1 class="h-1 mb-2">Inspiration & ideas</h1>
      <p class="text-muted mb-8 max-w-2xl">Room guides, styling ideas and care tips from our team.</p>
      @if (posts.value(); as p) {
        <div class="grid gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
          @for (post of p.items; track post.id; let i = $index) {
            <a [routerLink]="['/blog', post.slug]" class="group block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
              <div class="relative aspect-[16/10] overflow-hidden rounded-lg bg-gray-200">
                @if (post.cover_image) { <img [ngSrc]="post.cover_image" [alt]="post.title" fill [priority]="i < 3" sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" class="object-cover transition duration-300 group-hover:scale-105" /> }
              </div>
              <p class="mt-3 text-xs text-gray-500">{{ post.published_at | date: 'mediumDate' }}@if (post.author) { · {{ post.author }} }</p>
              <h2 class="mt-1 line-clamp-2 text-lg font-semibold group-hover:text-brand">{{ post.title }}</h2>
              @if (post.excerpt) { <p class="mt-1 line-clamp-3 text-sm text-gray-600">{{ post.excerpt }}</p> }
            </a>
          } @empty { <div class="empty-state col-span-full"><p class="font-medium">No posts yet</p><p class="text-muted text-sm">Check back soon for new ideas.</p></div> }
        </div>
        <app-pagination [page]="p.page" [pages]="p.pages" (pageChange)="go($event)" />
      } @else if (posts.isLoading()) {
        <div class="grid gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3" aria-busy="true" aria-label="Loading posts">
          @for (n of skeletons; track n) {
            <div><div class="skeleton aspect-[16/10] rounded-lg"></div><div class="skeleton mt-3 h-3 w-24"></div><div class="skeleton mt-2 h-5 w-3/4"></div></div>
          }
        </div>
      } @else if (posts.error()) {
        <div class="empty-state" role="alert">
          <p class="font-medium">Couldn't load posts</p>
          <button type="button" class="btn-outline mt-4" (click)="posts.reload()">Try again</button>
        </div>
      }
    </div>
  `,
})
export class BlogList {
  private readonly api = inject(Api);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly page = toSignal(this.route.queryParamMap.pipe(map((q) => Math.max(1, Number(q.get('page')) || 1))), { initialValue: 1 });

  protected readonly skeletons = [1, 2, 3, 4, 5, 6];
  protected readonly posts = rxResource({ params: () => this.page(), stream: ({ params }) => this.api.blog(params, PAGE_SIZE) });

  constructor() {
    inject(Seo).set({ title: 'Inspiration', description: 'Furniture ideas, room guides and care tips.', path: '/blog' });
  }

  protected go(page: number): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { page: page === 1 ? null : page } });
  }
}
