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
    <div class="container-x pb-12">
      <div class="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="h-1">Our showrooms</h1>
          @if (!showrooms.isLoading()) { <p class="text-muted mt-1 text-sm" aria-live="polite">{{ count() }} {{ count() === 1 ? 'location' : 'locations' }}</p> }
        </div>
        <label class="flex w-full items-center gap-2 text-sm sm:w-auto">City
          <select class="input flex-1 sm:!w-auto" [ngModel]="city() ?? ''" (ngModelChange)="setCity($event)">
            <option value="">All cities</option>
            @for (c of cities(); track c) { <option [value]="c">{{ c }}</option> }
          </select>
        </label>
      </div>

      <div class="mb-4 grid grid-cols-2 rounded-lg border border-gray-200 p-1 lg:hidden" role="group" aria-label="View">
        <button type="button" class="min-h-11 rounded-md text-sm font-medium" [class.bg-brand]="view() === 'list'" [class.text-white]="view() === 'list'"
                [attr.aria-pressed]="view() === 'list'" (click)="view.set('list')">List</button>
        <button type="button" class="min-h-11 rounded-md text-sm font-medium" [class.bg-brand]="view() === 'map'" [class.text-white]="view() === 'map'"
                [attr.aria-pressed]="view() === 'map'" (click)="view.set('map')">Map</button>
      </div>

      <div class="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <ul class="space-y-3 lg:block lg:max-h-[calc(100vh-10rem)] lg:overflow-auto lg:pr-1" [class.hidden]="view() !== 'list'" aria-label="Showroom list">
          @if (showrooms.isLoading()) {
            @for (n of [1, 2, 3]; track n) { <li><div class="skeleton h-32 rounded-lg"></div></li> }
          } @else {
            @for (s of showrooms.value(); track s.id) {
              <li>
                <article class="card cursor-pointer p-4 transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                         [class.ring-2]="selected() === s.id" [class.ring-brand]="selected() === s.id"
                         (click)="choose(s.id)" (keydown.enter)="choose(s.id)" tabindex="0" [attr.aria-current]="selected() === s.id ? 'true' : null">
                  <h2 class="font-semibold">{{ s.name }}</h2>
                  <p class="text-xs uppercase tracking-wide text-gray-500">{{ s.city }}</p>
                  <p class="mt-1 flex gap-1.5 text-sm text-gray-700"><app-icon name="pin" [size]="16" class="mt-0.5 shrink-0" /> <span>{{ s.address }}</span></p>
                  @if (s.opening_hours) { <p class="mt-1 flex gap-1.5 text-sm text-gray-700"><app-icon name="clock" [size]="16" class="mt-0.5 shrink-0" /> <span>{{ s.opening_hours }}@if (s.off_days) { · Closed {{ s.off_days }} }</span></p> }
                  <div class="mt-2 flex flex-wrap gap-x-4 text-sm">
                    @if (s.phone) { <a [href]="'tel:' + s.phone" class="inline-flex min-h-11 items-center font-medium text-brand hover:underline" (click)="$event.stopPropagation()">Call</a> }
                    @if (s.latitude !== null) {
                      <a [href]="directions(s)" target="_blank" rel="noopener noreferrer" class="inline-flex min-h-11 items-center font-medium text-brand hover:underline" (click)="$event.stopPropagation()">Directions</a>
                    }
                    <a [routerLink]="['/showrooms', s.slug]" class="inline-flex min-h-11 items-center font-medium text-brand hover:underline" (click)="$event.stopPropagation()">Details</a>
                  </div>
                </article>
              </li>
            } @empty {
              <li class="empty-state">
                <p class="font-medium">No showrooms found</p>
                @if (city()) { <button type="button" class="btn-outline mt-4" (click)="setCity('')">Show all cities</button> }
              </li>
            }
          }
        </ul>
        <app-showroom-map class="h-[60vh] min-h-[280px] lg:sticky lg:top-24 lg:block lg:h-[calc(100vh-10rem)] lg:min-h-[28rem]" [class.hidden]="view() !== 'map'"
                          [showrooms]="showrooms.value() ?? []" [selected]="selected()" (pick)="selected.set($event)" />
      </div>
    </div>
  `,
})
export class ShowroomsPage {
  private readonly api = inject(Api);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly selected = signal<number | null>(null);
  /** Mobile-only toggle; on lg both panes are visible side by side. */
  protected readonly view = signal<'list' | 'map'>('list');
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

  /** Selecting a card on mobile jumps to the map so the user sees the pin. */
  protected choose(id: number): void {
    this.selected.set(id);
    this.view.set('map');
  }

  protected directions(s: Showroom): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}`;
  }
}
