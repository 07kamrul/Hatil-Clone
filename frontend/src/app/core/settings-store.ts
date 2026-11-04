import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';

import { Api } from './api';
import { SiteSettings } from './models';
import { MapPoint, mapDirectionsUrl, mapEmbedUrl } from './maps-link';

export const DEFAULT_TEMPLATE =
  'Hello {site_name}! I would like to order:\n\n{items}\n\nTotal: {total}\n\nName: {name}\nPhone: {phone}\nAddress: {address}\nNote: {note}';

export const DEFAULT_SETTINGS: SiteSettings = {
  site_name: 'Furniture Store',
  tagline: '',
  logo_url: null,
  primary_color: '#8a5a2b',
  accent_color: '#1f2937',
  whatsapp_number: '',
  hotline: '',
  contact_email: '',
  address: '',
  map_lat: 25.3216,
  map_lng: 55.4018,
  map_zoom: 15,
  map_link: '',
  currency: 'AED',
  currency_symbol: 'AED ',
  message_template: DEFAULT_TEMPLATE,
  social_facebook: '',
  social_instagram: '',
  social_youtube: '',
  social_linkedin: '',
  footer_text: '',
  meta_description: '',
  log_inquiries: true,
};

/** Site-wide settings (branding, WhatsApp number, currency). Loaded once before first render. */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly api = inject(Api);
  private readonly doc = inject(DOCUMENT);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly state = signal<SiteSettings>(DEFAULT_SETTINGS);

  readonly settings = this.state.asReadonly();
  readonly whatsappLink = computed(() => `https://wa.me/${this.state().whatsapp_number}`);
  readonly mapPoint = computed<MapPoint>(() => ({ lat: this.state().map_lat, lng: this.state().map_lng }));
  readonly mapEmbedUrl = computed(() => mapEmbedUrl(this.mapPoint(), this.state().map_zoom));
  readonly mapEmbedUrlSafe = computed(() => this.sanitizer.bypassSecurityTrustResourceUrl(this.mapEmbedUrl()));
  readonly mapDirectionsUrl = computed(() => mapDirectionsUrl(this.mapPoint()));

  async load(): Promise<void> {
    try {
      this.state.set({ ...DEFAULT_SETTINGS, ...(await firstValueFrom(this.api.settings())) });
    } catch {
      /* API unreachable: keep defaults so the shell still renders */
    }
    this.applyBrand();
  }

  private applyBrand(): void {
    const s = this.state();
    const style = this.doc.documentElement.style;
    style.setProperty('--brand-primary', s.primary_color);
    style.setProperty('--brand-primary-dark', shade(s.primary_color, -0.2));
    style.setProperty('--brand-accent', s.accent_color);
  }
}

/** Darken (negative) or lighten (positive) a #rrggbb colour. */
export function shade(hex: string, amount: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return hex;
  const n = parseInt(match[1], 16);
  const channel = (shift: number) =>
    Math.max(0, Math.min(255, Math.round(((n >> shift) & 255) * (1 + amount))));
  return `#${[16, 8, 0].map((s) => channel(s).toString(16).padStart(2, '0')).join('')}`;
}
