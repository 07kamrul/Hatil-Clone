import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, afterNextRender, effect, input, output, signal, viewChild,
} from '@angular/core';
import type * as L from 'leaflet';

import { Showroom } from '../../core/models';
import { loadLeaflet, pinIcon } from '../../core/leaflet-loader';

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
    <div #host class="h-full min-h-[280px] w-full overflow-hidden rounded-lg bg-gray-100" role="region" aria-label="Showroom map"></div>
    @if (failed()) {
      <div class="mt-2 flex items-center gap-3 text-sm text-gray-500" role="alert">
        The map could not be loaded.
        <button type="button" class="inline-flex min-h-11 items-center px-2 text-xs font-medium underline hover:text-gray-900" (click)="retry()">Retry</button>
      </div>
    }
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
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    afterNextRender(() => {
      void this.init();
      // The map may start hidden (mobile list/map toggle); re-measure whenever the box changes size.
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
        this.resizeObserver.observe(this.host().nativeElement);
      }
    });
    inject(DestroyRef).onDestroy(() => {
      this.resizeObserver?.disconnect();
      this.map?.remove();
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

  protected retry(): void {
    void this.init();
  }

  private async init(): Promise<void> {
    try {
      this.failed.set(false);
      this.map?.remove(); // a retry must not stack a second map on the same container
      this.map = null;
      this.layer = null;
      this.markers.clear();
      this.leaflet = await loadLeaflet();
      this.map = this.leaflet.map(this.host().nativeElement, { scrollWheelZoom: false }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      this.leaflet.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(this.map);
      this.layer = this.leaflet.layerGroup().addTo(this.map);
      requestAnimationFrame(() => this.map?.invalidateSize());
      this.ready.set(true);
    } catch (error: unknown) {
      console.error('Leaflet failed to load', error);
      this.failed.set(true);
    }
  }

  private renderMarkers(showrooms: Showroom[]): void {
    const Lf = this.leaflet;
    if (!Lf || !this.map || !this.layer) return;
    this.layer.clearLayers();
    this.markers.clear();
    const icon = pinIcon(Lf);
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
