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
    <div class="container-x pb-10">
      <h1 class="mb-6 text-2xl font-bold sm:text-3xl">Inspiration & ideas</h1>
      @if (posts.value(); as p) {
        <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          @for (post of p.items; track post.id; let i = $index) {
            <a [routerLink]="['/blog', post.slug]" class="group block">
              <div class="relative aspect-[16/10] overflow-hidden rounded-lg bg-gray-200">
                @if (post.cover_image) { <img [ngSrc]="post.cover_image" [alt]="post.title" fill [priority]="i < 3" sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" class="object-cover transition duration-300 group-hover:scale-105" /> }
              </div>
              <p class="mt-3 text-xs text-gray-500">{{ post.published_at | date: 'mediumDate' }}@if (post.author) { · {{ post.author }} }</p>
              <h2 class="mt-1 text-lg font-semibold group-hover:text-brand">{{ post.title }}</h2>
              @if (post.excerpt) { <p class="mt-1 line-clamp-3 text-sm text-gray-600">{{ post.excerpt }}</p> }
            </a>
          } @empty { <p class="text-gray-500">No posts yet.</p> }
        </div>
        <app-pagination [page]="p.page" [pages]="p.pages" (pageChange)="go($event)" />
      }
    </div>
  `,
})
export class BlogList {
  private readonly api = inject(Api);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly page = toSignal(this.route.queryParamMap.pipe(map((q) => Math.max(1, Number(q.get('page')) || 1))), { initialValue: 1 });

  protected readonly posts = rxResource({ params: () => this.page(), stream: ({ params }) => this.api.blog(params, PAGE_SIZE) });

  constructor() {
    inject(Seo).set({ title: 'Inspiration', description: 'Furniture ideas, room guides and care tips.', path: '/blog' });
  }

  protected go(page: number): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { page: page === 1 ? null : page } });
  }
}
