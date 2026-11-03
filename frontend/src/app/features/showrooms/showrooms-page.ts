import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { Api } from '../../core/api';
import { Showroom } from '../../core/models';
import { Seo } from '../../core/seo';
import { Breadcrumbs } from '../../shared/ui/breadcrumbs';
import { Icon } from '../../shared/ui/icon';
import { ShowroomMap } from './showroom-map';

@Component({
  selector: 'app-showrooms-page',
  imports: [RouterLink, FormsModule, Breadcrumbs, Icon, ShowroomMap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-breadcrumbs [crumbs]="[{ label: 'Showrooms' }]" />
    <div class="container-x pb-10">
      <div class="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h1 class="text-2xl font-bold sm:text-3xl">Our showrooms</h1>
        <label class="flex items-center gap-2 text-sm">City
          <select class="input !w-auto" [ngModel]="city() ?? ''" (ngModelChange)="setCity($event)">
            <option value="">All cities</option>
            @for (c of cities(); track c) { <option [value]="c">{{ c }}</option> }
          </select>
        </label>
      </div>
      <div class="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <ul class="max-h-[36rem] space-y-3 overflow-auto pr-1" aria-label="Showroom list">
          @for (s of showrooms.value(); track s.id) {
            <li>
              <article class="card cursor-pointer p-4 transition hover:shadow-md" [class.ring-2]="selected() === s.id" [class.ring-brand]="selected() === s.id"
                       (click)="selected.set(s.id)" (keydown.enter)="selected.set(s.id)" tabindex="0">
                <h2 class="font-semibold">{{ s.name }}</h2>
                <p class="text-xs uppercase tracking-wide text-gray-500">{{ s.city }}</p>
                <p class="mt-1 flex gap-1.5 text-sm text-gray-700"><app-icon name="pin" [size]="16" /> {{ s.address }}</p>
                @if (s.opening_hours) { <p class="mt-1 flex gap-1.5 text-sm text-gray-700"><app-icon name="clock" [size]="16" /> {{ s.opening_hours }}@if (s.off_days) { · Closed {{ s.off_days }} }</p> }
                <div class="mt-2 flex gap-3 text-sm">
                  @if (s.phone) { <a [href]="'tel:' + s.phone" class="text-brand hover:underline" (click)="$event.stopPropagation()">Call</a> }
                  @if (s.latitude !== null) {
                    <a [href]="directions(s)" target="_blank" rel="noopener noreferrer" class="text-brand hover:underline" (click)="$event.stopPropagation()">Directions</a>
                  }
                  <a [routerLink]="['/showrooms', s.slug]" class="text-brand hover:underline" (click)="$event.stopPropagation()">Details</a>
                </div>
              </article>
            </li>
          } @empty {
            @if (!showrooms.isLoading()) { <li class="text-gray-500">No showrooms found.</li> }
          }
        </ul>
        <app-showroom-map class="h-[36rem]" [showrooms]="showrooms.value() ?? []" [selected]="selected()" (pick)="selected.set($event)" />
      </div>
    </div>
  `,
})
export class ShowroomsPage {
  private readonly api = inject(Api);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly selected = signal<number | null>(null);
  protected readonly city = toSignal(this.route.queryParamMap.pipe(map((q) => q.get('city'))), { initialValue: this.route.snapshot.queryParamMap.get('city') });
  protected readonly cities = toSignal(this.api.showroomCities().pipe(catchError(() => of([] as string[]))), { initialValue: [] as string[] });
  protected readonly showrooms = rxResource<Showroom[], { city: string | null }>({
    params: () => ({ city: this.city() }),
    stream: ({ params }) => this.api.showrooms(params.city ?? undefined).pipe(catchError(() => of([] as Showroom[]))),
  });
  protected readonly count = computed(() => this.showrooms.value()?.length ?? 0);

  constructor() {
    inject(Seo).set({ title: 'Showrooms', description: 'Find a furniture showroom near you — addresses, opening hours and directions.', path: '/showrooms' });
  }

  protected setCity(city: string): void {
    this.selected.set(null);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { city: city || null } });
  }

  protected directions(s: Showroom): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}`;
  }
}
