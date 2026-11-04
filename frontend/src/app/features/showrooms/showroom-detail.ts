import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { Api } from '../../core/api';
import { Showroom } from '../../core/models';
import { Seo } from '../../core/seo';
import { Breadcrumbs } from '../../shared/ui/breadcrumbs';
import { Icon } from '../../shared/ui/icon';
import { ShowroomMap } from './showroom-map';

@Component({
  selector: 'app-showroom-detail',
  imports: [RouterLink, NgOptimizedImage, Breadcrumbs, Icon, ShowroomMap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (showroom.value(); as s) {
      <app-breadcrumbs [crumbs]="[{ label: 'Showrooms', link: ['/showrooms'] }, { label: s.name }]" />
      <div class="container-x grid gap-8 pb-12 lg:grid-cols-2">
        <div class="min-w-0">
          <h1 class="heading-1 break-words">{{ s.name }}</h1>
          <p class="text-sm uppercase tracking-wide text-gray-500">{{ s.city }}</p>
          @if (s.image) {
            <div class="relative mt-4 aspect-[16/10] overflow-hidden rounded-lg"><img [ngSrc]="s.image" [alt]="s.name" fill priority sizes="(min-width:1024px) 50vw, 100vw" class="object-cover" /></div>
          }
          <ul class="mt-5 space-y-2 text-gray-700">
            <li class="flex gap-2"><app-icon name="pin" class="shrink-0" /> <span>{{ s.address }}</span></li>
            @if (s.phone) { <li class="flex gap-2"><app-icon name="phone" /> <a [href]="'tel:' + s.phone" class="inline-flex min-h-11 items-center hover:text-brand sm:min-h-0">{{ s.phone }}</a></li> }
            @if (s.email) { <li class="flex gap-2"><app-icon name="mail" /> <a [href]="'mailto:' + s.email" class="inline-flex min-h-11 items-center break-all hover:text-brand sm:min-h-0">{{ s.email }}</a></li> }
            @if (s.opening_hours) { <li class="flex gap-2"><app-icon name="clock" class="shrink-0" /> <span>{{ s.opening_hours }}@if (s.off_days) { · Closed {{ s.off_days }} }</span></li> }
          </ul>
          @if (s.latitude !== null) {
            <a class="btn-primary mt-5 w-full sm:w-auto" target="_blank" rel="noopener noreferrer"
               [href]="'https://www.google.com/maps/dir/?api=1&destination=' + s.latitude + ',' + s.longitude">Get directions</a>
          }
        </div>
        <app-showroom-map class="h-[50vh] min-h-[280px] lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)] lg:max-h-[40rem]" [showrooms]="[s]" />
      </div>
    } @else if (showroom.isLoading()) {
      <div class="container-x grid gap-8 py-8 lg:grid-cols-2" aria-busy="true" aria-label="Loading showroom">
        <div><div class="skeleton h-9 w-2/3"></div><div class="skeleton mt-4 aspect-[16/10] rounded-lg"></div></div>
        <div class="skeleton h-[50vh] rounded-lg lg:h-[28rem]"></div>
      </div>
    } @else {
      <div class="container-x empty-state my-16">
        <h1 class="heading-2">Showroom not found</h1>
        <p class="text-muted mt-2">It may have closed or moved.</p>
        <a routerLink="/showrooms" class="btn-primary mt-6">All showrooms</a>
      </div>
    }
  `,
})
export class ShowroomDetail {
  readonly slug = input.required<string>();
  private readonly api = inject(Api);
  private readonly seo = inject(Seo);

  protected readonly showroom = rxResource<Showroom | undefined, string>({
    params: () => this.slug(),
    stream: ({ params }) => this.api.showroom(params).pipe(catchError(() => {
      this.seo.setStatus(404);
      return of(undefined);
    })),
  });

  constructor() {
    effect(() => {
      const s = this.showroom.value();
      if (!s) return;
      this.seo.set({
        title: `${s.name} showroom`, description: `${s.name}, ${s.address}. ${s.opening_hours ?? ''}`, image: s.image, path: `/showrooms/${s.slug}`,
        jsonLd: {
          '@context': 'https://schema.org', '@type': 'FurnitureStore', name: s.name, telephone: s.phone ?? undefined, image: s.image ? this.seo.absolute(s.image) : undefined,
          address: { '@type': 'PostalAddress', streetAddress: s.address, addressLocality: s.city },
          ...(s.latitude !== null ? { geo: { '@type': 'GeoCoordinates', latitude: s.latitude, longitude: s.longitude } } : {}),
        },
      });
    });
  }
}
