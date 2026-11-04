import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { Api } from '../../core/api';
import { CmsPage } from '../../core/models';
import { Seo } from '../../core/seo';
import { Breadcrumbs } from '../../shared/ui/breadcrumbs';

/** About, Careers, Warranty, Privacy, Terms… — any admin-managed page at /page/:slug. */
@Component({
  selector: 'app-cms-page',
  imports: [RouterLink, Breadcrumbs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (page.value(); as p) {
      <app-breadcrumbs [crumbs]="[{ label: p.title }]" />
      <article class="container-x max-w-3xl pb-12">
        <h1 class="heading-1 mb-6 break-words">{{ p.title }}</h1>
        <div class="prose-content max-w-prose break-words [&_img]:h-auto [&_img]:max-w-full [&_iframe]:max-w-full [&_table]:block [&_table]:overflow-x-auto" [innerHTML]="p.body_html"></div>
      </article>
    } @else if (page.isLoading()) {
      <div class="container-x max-w-3xl py-8" aria-busy="true" aria-label="Loading page">
        <div class="skeleton h-9 w-1/2"></div>
        @for (n of [1, 2, 3, 4]; track n) { <div class="skeleton mt-4 h-4 w-full"></div> }
      </div>
    } @else {
      <div class="container-x empty-state my-16">
        <h1 class="heading-2">Page not found</h1>
        <p class="text-muted mt-2">This page doesn't exist or has moved.</p>
        <a routerLink="/" class="btn-primary mt-6">Go home</a>
      </div>
    }
  `,
})
export class CmsPageView {
  readonly slug = input.required<string>();
  private readonly api = inject(Api);
  private readonly seo = inject(Seo);

  protected readonly page = rxResource<CmsPage | undefined, string>({
    params: () => this.slug(),
    stream: ({ params }) => this.api.page(params).pipe(catchError(() => {
      this.seo.setStatus(404);
      this.seo.set({ title: 'Page not found', noindex: true });
      return of(undefined);
    })),
  });

  constructor() {
    effect(() => {
      const p = this.page.value();
      if (p) this.seo.set({ title: p.seo_title || p.title, description: p.seo_description, path: `/page/${p.slug}` });
    });
  }
}
