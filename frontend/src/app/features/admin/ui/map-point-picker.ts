import {
  ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, effect, model, signal, viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type * as L from 'leaflet';

import { mapDirectionsUrl, parseGoogleMapsLink } from '../../../core/maps-link';
import { loadLeaflet, pinIcon } from '../../../core/leaflet-loader';

export interface MapPointValue {
  map_lat: number;
  map_lng: number;
  map_zoom: number;
  map_link: string;
}

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; OpenStreetMap contributors';

/** Fallback view (Sharjah) used until valid coordinates are saved. */
const DEFAULT_CENTER: [number, number] = [25.3216, 55.4018];
const DEFAULT_ZOOM = 15;
const MIN_ZOOM = 1;
const MAX_ZOOM = 19;
const COPY_RESET_MS = 2000;

/** Empty or non-finite inputs (unsaved fields) must not crash the map. */
const isFiniteNumber = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);
const clampZoom = (v: number | null | undefined): number =>
  isFiniteNumber(v) ? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(v))) : DEFAULT_ZOOM;

/**
 * Settings editor for the shop's map location: click/drag the pin, paste a
 * Google Maps link, or use the device location; lat/lng/zoom are written back
 * via the ngModel group. Falls back to manual coordinate entry if Leaflet
 * cannot load.
 */
@Component({
  selector: 'app-map-point-picker',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Link toolbar -->
    <div class="flex flex-col gap-2 sm:flex-row">
      <label class="sr-only" for="map-link">Google Maps link</label>
      <input id="map-link" name="map_link" class="input w-full" placeholder="Paste a Google Maps link…"
             [(ngModel)]="value().map_link" (keyup.enter)="applyLink()" (blur)="applyLink()" />
      <div class="flex shrink-0 gap-2">
        <button type="button" class="btn-outline flex-1 sm:flex-none" (click)="applyLink()">Use link</button>
        @if (geoAvailable) {
          <button type="button" class="btn-outline flex-1 sm:flex-none" (click)="useMyLocation()"
                  [disabled]="locating()">📍 Use my location</button>
        }
      </div>
    </div>

    <!-- Map -->
    <div class="relative mt-3 w-full min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
      <div #host class="h-56 w-full cursor-crosshair md:h-80" role="application" tabindex="0"
           aria-label="Shop location map — click to move the pin"></div>
      @if (loading()) {
        <div class="absolute inset-0 flex animate-pulse items-center justify-center bg-gray-200 text-sm text-gray-500">
          Loading map…
        </div>
      } @else if (failed()) {
        <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-200 p-4 text-center">
          <p class="text-sm text-red-600">The map could not be loaded — enter coordinates manually below.</p>
          <button type="button" class="btn-outline" (click)="retry()">Retry</button>
        </div>
      } @else if (!hasPoint()) {
        <div class="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
          <span class="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-gray-700 shadow">
            Click the map or drag the pin to set the location
          </span>
        </div>
      }
    </div>

    <!-- Status -->
    <p class="mt-2 min-h-5 text-xs" aria-live="polite"
       [class.text-red-600]="tone() === 'error'" [class.text-emerald-700]="tone() === 'ok'"
       [class.text-gray-500]="tone() === 'info'">
      {{ status() }}
    </p>

    <!-- Current point summary -->
    @if (hasPoint()) {
      <div class="mt-1 flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
        <code class="min-w-0 break-all text-xs text-gray-700">📍 {{ pointLabel() }}</code>
        <span class="ml-auto flex gap-2">
          <button type="button" class="text-xs font-medium text-gray-600 underline hover:text-gray-900" (click)="copyPoint()">
            {{ copied() ? 'Copied!' : 'Copy' }}
          </button>
          <a class="text-xs font-medium text-gray-600 underline hover:text-gray-900" target="_blank" rel="noopener"
             [href]="mapsUrl()">Open in Google Maps</a>
        </span>
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
        <div class="mt-2 grid gap-3 sm:grid-cols-3">
          <div><label class="label" for="map-lat">Latitude</label>
            <input id="map-lat" name="map_lat" type="number" step="any" min="-90" max="90" class="input" [(ngModel)]="value().map_lat" /></div>
          <div><label class="label" for="map-lng">Longitude</label>
            <input id="map-lng" name="map_lng" type="number" step="any" min="-180" max="180" class="input" [(ngModel)]="value().map_lng" /></div>
          <div><label class="label" for="map-zoom">Zoom ({{ MIN_ZOOM }}–{{ MAX_ZOOM }})</label>
            <input id="map-zoom" name="map_zoom" type="number" [min]="MIN_ZOOM" [max]="MAX_ZOOM" class="input" [(ngModel)]="value().map_zoom" /></div>
        </div>
        @if (zoomInvalid()) { <p class="mt-1 text-xs text-red-600">Zoom must be between {{ MIN_ZOOM }} and {{ MAX_ZOOM }}.</p> }
        <p class="mt-1 text-xs text-gray-500">Short goo.gl links have no coordinates — move the pin on the map instead.</p>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    :host ::ng-deep .leaflet-container { font: inherit; }
  `,
})
export class MapPointPicker {
  readonly value = model.required<MapPointValue>();

  protected readonly MIN_ZOOM = MIN_ZOOM;
  protected readonly MAX_ZOOM = MAX_ZOOM;

  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly showManual = signal(false);
  protected readonly copied = signal(false);
  protected readonly locating = signal(false);
  protected readonly status = signal('');
  protected readonly tone = signal<'ok' | 'error' | 'info'>('info');
  protected readonly geoAvailable = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  private readonly host = viewChild<ElementRef<HTMLDivElement>>('host');
  private leaflet: typeof L | null = null;
  private map: L.Map | null = null;
  private marker: L.Marker | null = null;
  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    afterNextRender(() => void this.initMap());

    effect(() => {
      const v = this.value();
      if (!this.map || !isFiniteNumber(v.map_lat) || !isFiniteNumber(v.map_lng)) return;
      const zoom = clampZoom(v.map_zoom);
      const center = this.map.getCenter();
      if (Math.abs(center.lat - v.map_lat) > 1e-9 || Math.abs(center.lng - v.map_lng) > 1e-9) {
        this.map.setView([v.map_lat, v.map_lng], zoom, { animate: false });
      }
      if (this.marker) {
        const p = this.marker.getLatLng();
        if (Math.abs(p.lat - v.map_lat) > 1e-9 || Math.abs(p.lng - v.map_lng) > 1e-9) this.marker.setLatLng([v.map_lat, v.map_lng]);
      } else {
        this.marker = this.placeMarker([v.map_lat, v.map_lng]);
      }
    });
  }

  protected readonly hasPoint = computed(() => {
    const v = this.value();
    return isFiniteNumber(v.map_lat) && isFiniteNumber(v.map_lng);
  });
  protected readonly pointLabel = computed(() => {
    const v = this.value();
    return this.hasPoint() ? `${v.map_lat.toFixed(5)}, ${v.map_lng.toFixed(5)} · zoom ${clampZoom(v.map_zoom)}` : '';
  });
  protected readonly zoomInvalid = computed(() => {
    const z = this.value().map_zoom;
    return isFiniteNumber(z) && (z < MIN_ZOOM || z > MAX_ZOOM);
  });
  protected readonly mapsUrl = computed(() => {
    const v = this.value();
    return this.hasPoint() ? mapDirectionsUrl({ lat: v.map_lat, lng: v.map_lng }) : '';
  });

  protected notify(message: string, tone: 'ok' | 'error' | 'info' = 'info'): void {
    this.status.set(message);
    this.tone.set(tone);
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
      const v = this.value();
      const lat = isFiniteNumber(v.map_lat) ? v.map_lat : DEFAULT_CENTER[0];
      const lng = isFiniteNumber(v.map_lng) ? v.map_lng : DEFAULT_CENTER[1];
      const map = this.leaflet.map(this.host()!.nativeElement, {
        scrollWheelZoom: false,
        zoomControl: true,
      }).setView([lat, lng], clampZoom(v.map_zoom));
      this.leaflet.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: MAX_ZOOM }).addTo(map);
      map.on('click', (e: L.LeafletMouseEvent) => this.setPoint(e.latlng.lat, e.latlng.lng));
      map.on('zoomend', () => {
        const z = map.getZoom();
        if (z !== this.value().map_zoom) this.value.set({ ...this.value(), map_zoom: z });
      });
      this.map = map;
      // Tiles render before layout settles when the host resizes; re-measure once.
      requestAnimationFrame(() => map.invalidateSize());
      if (this.hasPoint()) this.marker = this.placeMarker([v.map_lat, v.map_lng]);
      this.notify('Click the map to move the pin, or paste a Google Maps link.');
    } catch (error: unknown) {
      console.error('Leaflet failed to load', error);
      this.failed.set(true);
      this.showManual.set(true);
      this.notify('The map could not be loaded — enter coordinates below.', 'error');
    } finally {
      this.loading.set(false);
    }
  }

  protected retry(): void {
    if (this.host()) void this.initMap();
  }

  protected applyLink(): void {
    const url = this.value().map_link.trim();
    if (!url) return;
    const point = parseGoogleMapsLink(url);
    if (point) {
      this.setPoint(point.lat, point.lng);
      this.notify('Coordinates taken from the link.', 'ok');
    } else {
      this.notify('No coordinates found in the link — move the pin on the map instead.', 'error');
    }
  }

  protected useMyLocation(): void {
    this.locating.set(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.locating.set(false);
        this.setPoint(pos.coords.latitude, pos.coords.longitude);
        this.notify('Location set from your device.', 'ok');
      },
      (err) => {
        this.locating.set(false);
        this.notify(err.code === err.PERMISSION_DENIED
          ? 'Location permission denied — click the map instead.'
          : 'Could not get your location — click the map instead.', 'error');
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  protected copyPoint(): void {
    const text = this.pointLabel();
    const done = () => {
      this.copied.set(true);
      if (this.copyTimer) clearTimeout(this.copyTimer);
      this.copyTimer = setTimeout(() => this.copied.set(false), COPY_RESET_MS);
    };
    navigator.clipboard?.writeText(text).then(done).catch(() => this.notify('Could not copy — select the text instead.', 'error'));
  }

  private setPoint(lat: number, lng: number): void {
    this.value.set({ ...this.value(), map_lat: lat, map_lng: lng });
  }

  private placeMarker(latlng: L.LatLngExpression): L.Marker {
    const marker = this.leaflet!.marker(latlng, { icon: pinIcon(this.leaflet!), draggable: true }).addTo(this.map!);
    marker.on('dragend', () => {
      const p = marker.getLatLng();
      this.setPoint(p.lat, p.lng);
    });
    return marker;
  }
}
