import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

import { MapPoint, mapDirectionsUrl, mapEmbedUrl } from '../../core/maps-link';
import { Showroom } from '../../core/models';
import { Icon } from '../../shared/ui/icon';

const SHOWROOM_ZOOM = 15;

/** First showroom with coordinates, preferring the selected one. */
export function pickActiveShowroom(showrooms: readonly Showroom[], selected: number | null): Showroom | null {
  const located = showrooms.filter((s) => s.latitude !== null && s.longitude !== null);
  return located.find((s) => s.id === selected) ?? located[0] ?? null;
}

/** Google Maps embed for one showroom, styled like the contact page's "Find us" map. */
@Component({
  selector: 'app-showroom-map',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (point(); as p) {
      <iframe class="h-[50vh] max-h-[420px] min-h-[280px] w-full rounded-lg border border-gray-200 bg-gray-100 lg:h-[420px]"
              [src]="embedUrl()" loading="lazy" [title]="'Map to ' + showroom()!.name"
              referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>
      @if (showDetails()) {
        <p class="mt-3 flex items-start gap-2 text-sm text-gray-600"><app-icon name="pin" [size]="16" class="mt-0.5 shrink-0" /> {{ showroom()!.address }}</p>
        <a [href]="directionsUrl()" target="_blank" rel="noopener noreferrer" class="btn-outline mt-3 w-full sm:w-auto">
          <app-icon name="pin" [size]="16" /> Open in Google Maps
        </a>
      }
    } @else {
      <div class="grid h-[280px] place-items-center rounded-lg border border-gray-200 bg-gray-100 text-sm text-gray-500">Location coming soon</div>
    }
  `,
  styles: `:host { display: block; }`,
})
export class ShowroomMap {
  private readonly sanitizer = inject(DomSanitizer);

  readonly showroom = input<Showroom | null>(null);
  /** Address line + "Open in Google Maps" button under the map. */
  readonly showDetails = input(true);

  protected readonly point = computed<MapPoint | null>(() => {
    const s = this.showroom();
    return s && s.latitude !== null && s.longitude !== null ? { lat: s.latitude, lng: s.longitude } : null;
  });
  protected readonly embedUrl = computed(() => {
    const p = this.point();
    return p ? this.sanitizer.bypassSecurityTrustResourceUrl(mapEmbedUrl(p, SHOWROOM_ZOOM)) : null;
  });
  protected readonly directionsUrl = computed(() => {
    const p = this.point();
    return p ? mapDirectionsUrl(p) : null;
  });
}
