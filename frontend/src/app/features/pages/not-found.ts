import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Seo } from '../../core/seo';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container-x py-24 text-center">
      <p class="text-6xl font-bold text-brand">404</p>
      <h1 class="mt-3 text-2xl font-bold">Page not found</h1>
      <p class="mt-2 text-gray-600">The page you are looking for does not exist or has moved.</p>
      <div class="mt-6 flex justify-center gap-3"><a routerLink="/" class="btn-primary">Go home</a><a routerLink="/products" class="btn-outline">Browse products</a></div>
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
