import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Seo } from '../../core/seo';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container-x flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <p class="text-6xl font-bold text-brand sm:text-7xl" aria-hidden="true">404</p>
      <h1 class="heading-2 mt-3">Page not found</h1>
      <p class="text-muted mt-2 max-w-md">The page you are looking for does not exist or has moved.</p>
      <div class="mt-8 flex w-full max-w-sm flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:justify-center">
        <a routerLink="/" class="btn-primary">Go home</a>
        <a routerLink="/products" class="btn-outline">Browse products</a>
      </div>
      <nav class="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm" aria-label="Helpful links">
        <a routerLink="/showrooms" class="inline-flex min-h-11 items-center text-brand hover:underline">Showrooms</a>
        <a routerLink="/blog" class="inline-flex min-h-11 items-center text-brand hover:underline">Inspiration</a>
        <a routerLink="/contact" class="inline-flex min-h-11 items-center text-brand hover:underline">Contact us</a>
      </nav>
    </div>
  `,
})
export class NotFound {
  constructor() {
    const seo = inject(Seo);
    seo.setStatus(404);
    seo.set({ title: 'Page not found', noindex: true });
  }
}
