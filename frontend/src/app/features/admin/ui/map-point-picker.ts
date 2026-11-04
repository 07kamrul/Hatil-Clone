import {
  ChangeDetectionStrategy, Component, ElementRef, afterNextRender, effect, input, model, signal, viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type * as L from 'leaflet';

import { parseGoogleMapsLink } from '../../../core/maps-link';

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

/** Empty or non-finite inputs (unsaved fields) must not crash the map. */
const isFiniteNumber = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Settings editor for the shop's map location: click/drag the pin, or paste a
 * Google Maps link; lat/lng/zoom are written back via the ngModel group.
 */
@Component({
  selector: 'app-map-point-picker',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #host class="h-72 w-full cursor-crosshair rounded-lg border border-gray-200 bg-gray-100" role="application"
         aria-label="Shop location map — click to move the pin"></div>
    @if (failed()) { <p class="mt-1 text-sm text-red-600">The map could not be loaded — enter coordinates below instead.</p> }
    <div class="mt-3 grid gap-3 sm:grid-cols-3">
      <div><label class="label" for="map-lat">Latitude</label>
        <input id="map-lat" name="map_lat" type="number" step="any" min="-90" max="90" class="input" [(ngModel)]="value().map_lat" /></div>
      <div><label class="label" for="map-lng">Longitude</label>
        <input id="map-lng" name="map_lng" type="number" step="any" min="-180" max="180" class="input" [(ngModel)]="value().map_lng" /></div>
      <div><label class="label" for="map-zoom">Zoom (1–20)</label>
        <input id="map-zoom" name="map_zoom" type="number" min="1" max="20" class="input" [(ngModel)]="value().map_zoom" /></div>
    </div>
    <div class="mt-3">
      <label class="label" for="map-link">Google Maps link (optional)</label>
      <div class="flex gap-2">
        <input id="map-link" name="map_link" class="input" placeholder="https://www.google.com/maps/place/…"
               [(ngModel)]="value().map_link" (blur)="applyLink()" />
        <button type="button" class="btn-outline shrink-0" (click)="applyLink()">Use link</button>
      </div>
      @if (linkNote()) { <p class="mt-1 text-xs" [class.text-red-600]="linkError()" [class.text-gray-500]="!linkError()">{{ linkNote() }}</p> }
      <p class="mt-1 text-xs text-gray-500">Click the map to move the pin, or paste a Google Maps link with coordinates (short goo.gl links have none).</p>
    </div>
  `,
  styles: `:host { display: block; }`,
})
export class MapPointPicker {
  readonly value = model.required<MapPointValue>();

  protected readonly failed = signal(false);
  protected readonly linkNote = signal('');
  protected readonly linkError = signal(false);
  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private leaflet: typeof L | null = null;
  private map: L.Map | null = null;
  private marker: L.Marker | null = null;

  constructor() {
    afterNextRender(async () => {
      try {
        this.leaflet = await import('leaflet');
        const v = this.value();
        const lat = isFiniteNumber(v.map_lat) ? v.map_lat : DEFAULT_CENTER[0];
        const lng = isFiniteNumber(v.map_lng) ? v.map_lng : DEFAULT_CENTER[1];
        const zoom = isFiniteNumber(v.map_zoom) ? Math.min(20, Math.max(1, v.map_zoom)) : DEFAULT_ZOOM;
        this.map = this.leaflet.map(this.host().nativeElement, { scrollWheelZoom: false }).setView([lat, lng], zoom);
        this.leaflet.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(this.map);
        if (isFiniteNumber(v.map_lat) && isFiniteNumber(v.map_lng)) this.marker = this.placeMarker([lat, lng]);
        this.map.on('click', (e: L.LeafletMouseEvent) => this.setPoint(e.latlng.lat, e.latlng.lng));
      } catch {
        this.failed.set(true);
      }
    });

    effect(() => {
      const v = this.value();
      if (this.map && isFiniteNumber(v.map_lat) && isFiniteNumber(v.map_lng)) {
        const zoom = isFiniteNumber(v.map_zoom) ? Math.min(20, Math.max(1, v.map_zoom)) : DEFAULT_ZOOM;
        this.map.setView([v.map_lat, v.map_lng], zoom, { animate: false });
        if (this.marker) this.marker.setLatLng([v.map_lat, v.map_lng]);
        else this.marker = this.placeMarker([v.map_lat, v.map_lng]);
      }
    });
  }

  protected applyLink(): void {
    const url = this.value().map_link.trim();
    if (!url) return;
    const point = parseGoogleMapsLink(url);
    if (point) {
      this.linkError.set(false);
      this.linkNote.set('Coordinates taken from the link.');
      this.setPoint(point.lat, point.lng);
    } else {
      this.linkError.set(true);
      this.linkNote.set('No coordinates found in the link — move the pin on the map instead.');
    }
  }

  private setPoint(lat: number, lng: number): void {
    this.value.set({ ...this.value(), map_lat: lat, map_lng: lng });
  }

  private placeMarker(latlng: L.LatLngExpression): L.Marker {
    const marker = this.leaflet!.marker(latlng, { draggable: true }).addTo(this.map!);
    marker.on('dragend', () => {
      const p = marker.getLatLng();
      this.setPoint(p.lat, p.lng);
    });
    return marker;
  }
}
