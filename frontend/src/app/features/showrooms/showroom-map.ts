import {
  ChangeDetectionStrategy, Component, ElementRef, afterNextRender, effect, input, output, signal, viewChild,
} from '@angular/core';
import type * as L from 'leaflet';

import { Showroom } from '../../core/models';

const DEFAULT_CENTER: [number, number] = [23.8103, 90.4125];
const DEFAULT_ZOOM = 7;
const SINGLE_ZOOM = 15;
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; OpenStreetMap contributors';

/** Leaflet map; loaded lazily and only in the browser (Leaflet touches `window`). */
@Component({
  selector: 'app-showroom-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #host class="h-full min-h-[320px] w-full rounded-lg bg-gray-100" role="region" aria-label="Showroom map"></div>
    @if (failed()) { <p class="mt-2 text-sm text-gray-500">The map could not be loaded.</p> }
  `,
  styles: `:host { display: block; }`,
})
export class ShowroomMap {
  readonly showrooms = input.required<Showroom[]>();
  readonly selected = input<number | null>(null);
  readonly pick = output<number>();

  protected readonly failed = signal(false);
  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private readonly ready = signal(false);
  private leaflet: typeof L | null = null;
  private map: L.Map | null = null;
  private layer: L.LayerGroup | null = null;
  private markers = new Map<number, L.Marker>();

  constructor() {
    afterNextRender(async () => {
      try {
        this.leaflet = await import('leaflet');
        this.map = this.leaflet.map(this.host().nativeElement, { scrollWheelZoom: false }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
        this.leaflet.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(this.map);
        this.layer = this.leaflet.layerGroup().addTo(this.map);
        this.ready.set(true);
      } catch {
        this.failed.set(true);
      }
    });

    effect(() => {
      if (this.ready()) this.renderMarkers(this.showrooms());
    });
    effect(() => {
      const id = this.selected();
      if (!this.ready() || id === null) return;
      const marker = this.markers.get(id);
      if (marker && this.map) {
        this.map.setView(marker.getLatLng(), SINGLE_ZOOM);
        marker.openPopup();
      }
    });
  }

  private renderMarkers(showrooms: Showroom[]): void {
    const Lf = this.leaflet;
    if (!Lf || !this.map || !this.layer) return;
    this.layer.clearLayers();
    this.markers.clear();
    const icon = Lf.divIcon({
      className: '',
      html: '<span style="display:block;width:18px;height:18px;border-radius:9999px;background:var(--color-brand);border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    const points: L.LatLngExpression[] = [];
    for (const s of showrooms) {
      if (s.latitude === null || s.longitude === null) continue;
      const popup = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = s.name;
      const address = document.createElement('div');
      address.textContent = s.address;
      popup.append(title, address);
      const marker = Lf.marker([s.latitude, s.longitude], { icon, title: s.name }).bindPopup(popup);
      marker.on('click', () => this.pick.emit(s.id));
      marker.addTo(this.layer);
      this.markers.set(s.id, marker);
      points.push([s.latitude, s.longitude]);
    }
    if (points.length === 1) this.map.setView(points[0], SINGLE_ZOOM);
    else if (points.length > 1) this.map.fitBounds(Lf.latLngBounds(points), { padding: [30, 30] });
  }
}
