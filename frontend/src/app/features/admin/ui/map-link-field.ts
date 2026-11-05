import {
  ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, effect, inject, input, signal, viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type * as L from 'leaflet';

import { mapDirectionsUrl, parseGoogleMapsLink } from '../../../core/maps-link';
import { loadLeaflet, pinIcon } from '../../../core/leaflet-loader';
import { AdminApi, apiError } from '../core/admin-api';

export interface MapLinkModel {
  maplink?: string;
  latitude?: number | null;
  longitude?: number | null;
}

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; OpenStreetMap contributors';
/** Fallback view (Sharjah) used until coordinates are set. */
const DEFAULT_CENTER: [number, number] = [25.3216, 55.4018];
const DEFAULT_ZOOM = 14;
const MAX_ZOOM = 19;

/** Empty or non-finite inputs (unsaved fields) must not crash the map. */
const isFiniteNumber = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Admin form field for a showroom location: paste a Google Maps link, the
 * coordinates are parsed client-side (or resolved server-side for short
 * goo.gl links) and written into the form's latitude/longitude. A Leaflet
 * preview shows the pin; drag or click it to fine-tune. Falls back to
 * manual coordinate entry if Leaflet cannot load.
 */
@Component({
  selector: 'app-map-link-field',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="label" for="maplink">Google Maps link</label>
    <div class="flex flex-col gap-2 sm:flex-row">
      <input id="maplink" name="maplink" class="input w-full" autocomplete="off"
             placeholder="Paste a Google Maps link…" [(ngModel)]="link" (blur)="applyLink()" (keyup.enter)="applyLink()" />
      <button type="button" class="btn-outline shrink-0" (click)="applyLink()" [disabled]="resolving()">
        {{ resolving() ? 'Resolving…' : 'Use link' }}
      </button>
    </div>

    <!-- Preview map -->
    <div class="relative mt-3 w-full min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
      <div #host class="h-56 w-full cursor-crosshair md:h-72" role="application" tabindex="0"
           aria-label="Showroom location map — click to move the pin"></div>
      @if (loading()) {
        <div class="absolute inset-0 flex animate-pulse items-center justify-center bg-gray-200 text-sm text-gray-500">Loading map…</div>
      } @else if (failed()) {
        <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-200 p-4 text-center">
          <p class="text-sm text-red-600">The map preview could not be loaded — enter coordinates manually below.</p>
          <button type="button" class="btn-outline" (click)="retry()">Retry</button>
        </div>
      } @else if (!hasPoint()) {
        <div class="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
          <span class="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-gray-700 shadow">
            Paste a link or click the map to set the location
          </span>
        </div>
      }
    </div>

    <!-- Status -->
    <p class="mt-2 min-h-5 text-xs" aria-live="polite"
       [class.text-red-600]="tone() === 'error'" [class.text-emerald-700]="tone() === 'ok'"
       [class.text-gray-500]="tone() === 'info'">{{ status() }}</p>

    @if (hasPoint()) {
      <div class="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
        <code class="min-w-0 break-all text-xs text-gray-700">📍 {{ pointLabel() }}</code>
        <a class="ml-auto text-xs font-medium text-gray-600 underline hover:text-gray-900" target="_blank" rel="noopener"
           [href]="mapsUrl()">Open in Google Maps</a>
      </div>
    }

    <!-- Manual coordinates -->
    <div class="mt-3">
      <button type="button" class="flex min-h-11 items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900"
              (click)="showManual.set(!showManual())" [attr.aria-expanded]="showManual()">
        <span class="inline-block transition-transform" [class.rotate-90]="showManual()">▸</span>
        Enter coordinates manually
      </button>
      @if (showManual()) {
        <div class="mt-2 grid gap-3 sm:grid-cols-2">
          <div><label class="label" for="maplink-lat">Latitude</label>
            <input id="maplink-lat" name="latitude" type="number" step="any" min="-90" max="90" class="input"
                   [ngModel]="lat()" (ngModelChange)="setPoint($event, lng())" /></div>
          <div><label class="label" for="maplink-lng">Longitude</label>
            <input id="maplink-lng" name="longitude" type="number" step="any" min="-180" max="180" class="input"
                   [ngModel]="lng()" (ngModelChange)="setPoint(lat(), $event)" /></div>
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    :host ::ng-deep .leaflet-container { font: inherit; }
  `,
})
export class MapLinkField {
  /** The surrounding ResourceForm model; latitude/longitude are written here. */
  readonly model = input.required<Record<string, unknown>>();

  protected readonly link = signal('');
  protected readonly resolving = signal(false);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly showManual = signal(false);
  protected readonly status = signal('');
  protected readonly tone = signal<'ok' | 'error' | 'info'>('info');

  private readonly api = inject(AdminApi);
  private readonly host = viewChild<ElementRef<HTMLDivElement>>('host');
  private leaflet: typeof L | null = null;
  private map: L.Map | null = null;
  private marker: L.Marker | null = null;

  /** Local mirror of the model's coordinates; the plain model object is not reactive. */
  protected readonly point = signal<{ lat: number | null; lng: number | null }>({
    lat: this.number('latitude'), lng: this.number('longitude'),
  });
  protected readonly lat = computed(() => this.point().lat);
  protected readonly lng = computed(() => this.point().lng);
  protected readonly hasPoint = computed(() => isFiniteNumber(this.lat()) && isFiniteNumber(this.lng()));
  protected readonly pointLabel = computed(() =>
    this.hasPoint() ? `${this.lat()!.toFixed(5)}, ${this.lng()!.toFixed(5)}` : '');
  protected readonly mapsUrl = computed(() =>
    this.hasPoint() ? mapDirectionsUrl({ lat: this.lat()!, lng: this.lng()! }) : '');

  private readonly syncMap = effect(() => {
    const lat = this.lat();
    const lng = this.lng();
    if (!this.map || !isFiniteNumber(lat) || !isFiniteNumber(lng)) return;
    const center = this.map.getCenter();
    if (Math.abs(center.lat - lat) > 1e-9 || Math.abs(center.lng - lng) > 1e-9) {
      this.map.setView([lat, lng], Math.max(this.map.getZoom(), DEFAULT_ZOOM), { animate: false });
    }
    if (this.marker) {
      const p = this.marker.getLatLng();
      if (Math.abs(p.lat - lat) > 1e-9 || Math.abs(p.lng - lng) > 1e-9) this.marker.setLatLng([lat, lng]);
    } else {
      this.marker = this.placeMarker([lat, lng]);
    }
  });

  constructor() {
    afterNextRender(() => void this.initMap());
  }

  private number(key: string): number | null {
    const v = this.model()[key];
    return isFiniteNumber(v as number | null | undefined) ? (v as number) : null;
  }

  protected async initMap(): Promise<void> {
    if (!this.host()) return;
    this.loading.set(true);
    this.failed.set(false);
    this.map?.remove(); // a retry must not stack a second map on the same container
    this.map = null;
    this.marker = null;
    try {
      this.leaflet = await loadLeaflet();
      const lat = this.lat() ?? DEFAULT_CENTER[0];
      const lng = this.lng() ?? DEFAULT_CENTER[1];
      const map = this.leaflet.map(this.host()!.nativeElement, { scrollWheelZoom: false })
        .setView([lat, lng], this.hasPoint() ? DEFAULT_ZOOM + 1 : DEFAULT_ZOOM);
      this.leaflet.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: MAX_ZOOM }).addTo(map);
      map.on('click', (e: L.LeafletMouseEvent) => this.setPoint(e.latlng.lat, e.latlng.lng));
      this.map = map;
      requestAnimationFrame(() => map.invalidateSize());
      if (this.hasPoint()) this.marker = this.placeMarker([lat, lng]);
    } catch (error: unknown) {
      console.error('Leaflet failed to load', error);
      this.failed.set(true);
      this.showManual.set(true);
      this.notify('The map preview could not be loaded — enter coordinates manually.', 'error');
    } finally {
      this.loading.set(false);
    }
  }

  protected retry(): void {
    if (this.host()) void this.initMap();
  }

  protected applyLink(): void {
    const url = this.link().trim();
    if (!url) return;
    const point = parseGoogleMapsLink(url);
    if (point) {
      this.setPoint(point.lat, point.lng);
      this.notify('Coordinates taken from the link.', 'ok');
      return;
    }
    // Short links (maps.app.goo.gl/…) carry no coordinates — ask the backend to follow the redirect.
    this.resolving.set(true);
    this.api.resolveMapsLink(url).subscribe({
      next: (res) => {
        this.resolving.set(false);
        this.setPoint(res.latitude, res.longitude);
        this.notify('Coordinates taken from the link.', 'ok');
      },
      error: (err: unknown) => {
        this.resolving.set(false);
        this.notify(apiError(err, 'No coordinates found in that link — enter them manually.'), 'error');
      },
    });
  }

  protected setPoint(lat: number | null, lng: number | null): void {
    this.point.set({ lat, lng });
    // ResourceForm owns this object; write in place so its bindings stay live.
    this.model()['latitude'] = lat;
    this.model()['longitude'] = lng;
  }

  private placeMarker(latlng: L.LatLngExpression): L.Marker {
    const marker = this.leaflet!.marker(latlng, { icon: pinIcon(this.leaflet!), draggable: true }).addTo(this.map!);
    marker.on('dragend', () => {
      const p = marker.getLatLng();
      this.setPoint(p.lat, p.lng);
    });
    return marker;
  }

  private notify(message: string, tone: 'ok' | 'error' | 'info' = 'info'): void {
    this.status.set(message);
    this.tone.set(tone);
  }
}
