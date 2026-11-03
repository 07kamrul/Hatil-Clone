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
        <h1 class="mb-6 text-3xl font-bold">{{ p.title }}</h1>
        <div class="prose-content" [innerHTML]="p.body_html"></div>
      </article>
    } @else if (!page.isLoading()) {
      <div class="container-x py-24 text-center"><h1 class="text-2xl font-bold">Page not found</h1><a routerLink="/" class="btn-primary mt-6">Go home</a></div>
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
