import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { SettingsStore } from '../../../core/settings-store';
import { Toast } from '../../../core/toast';
import { AdminApi, apiError } from '../core/admin-api';
import { FormActions } from '../ui/form-actions';
import { ImageInput } from '../ui/image-input';
import { PageHeader } from '../ui/page-header';
import { MapPointPicker, MapPointValue } from '../ui/map-point-picker';

type Kind = 'text' | 'textarea' | 'color' | 'image' | 'checkbox' | 'map';
interface SettingField { key: string; label: string; kind: Kind; help?: string }

const GROUPS: { title: string; fields: SettingField[] }[] = [
  { title: 'Brand', fields: [
    { key: 'site_name', label: 'Site name', kind: 'text' },
    { key: 'tagline', label: 'Tagline', kind: 'text' },
    { key: 'logo_url', label: 'Logo', kind: 'image' },
    { key: 'primary_color', label: 'Primary colour', kind: 'color' },
    { key: 'accent_color', label: 'Accent colour', kind: 'color' },
    { key: 'footer_text', label: 'Footer text', kind: 'textarea' },
    { key: 'meta_description', label: 'Default meta description', kind: 'textarea' },
  ] },
  { title: 'WhatsApp ordering', fields: [
    { key: 'whatsapp_number', label: 'WhatsApp number', kind: 'text', help: 'Country code + number, e.g. 971558907793' },
    { key: 'message_template', label: 'Order message template', kind: 'textarea',
      help: 'Placeholders: {site_name} {items} {total} {name} {phone} {address} {note}' },
    { key: 'log_inquiries', label: 'Log anonymous order inquiries for analytics', kind: 'checkbox' },
    { key: 'currency', label: 'Currency code', kind: 'text' },
    { key: 'currency_symbol', label: 'Currency symbol', kind: 'text' },
    { key: 'default_warranty', label: 'Default warranty text', kind: 'text' },
  ] },
  { title: 'Contact', fields: [
    { key: 'hotline', label: 'Hotline', kind: 'text' },
    { key: 'contact_email', label: 'Email', kind: 'text' },
    { key: 'address', label: 'Address', kind: 'textarea' },
    { key: 'map_link', label: 'Map location', kind: 'map', help: 'Shown on the contact page with a directions button.' },
  ] },
  { title: 'Social links', fields: [
    { key: 'social_facebook', label: 'Facebook URL', kind: 'text' },
    { key: 'social_instagram', label: 'Instagram URL', kind: 'text' },
    { key: 'social_youtube', label: 'YouTube URL', kind: 'text' },
    { key: 'social_linkedin', label: 'LinkedIn URL', kind: 'text' },
  ] },
];

@Component({
  selector: 'app-admin-settings',
  imports: [FormsModule, ImageInput, MapPointPicker, FormActions, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Settings" subtitle="Branding, contact details and site-wide options." />
    @if (loaded()) {
      <form class="max-w-4xl space-y-6" (submit)="save($event)">
        @for (g of groups; track g.title) {
          <section class="card grid gap-4 p-4 sm:p-5 md:grid-cols-2">
            <h2 class="font-semibold md:col-span-2">{{ g.title }}</h2>
            @for (f of g.fields; track f.key) {
              <div class="min-w-0" [class.md:col-span-2]="f.kind === 'textarea' || f.kind === 'map' || f.kind === 'image'">
                @switch (f.kind) {
                  @case ('checkbox') { <label class="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" class="h-5 w-5" [name]="f.key" [(ngModel)]="values[f.key]" /> {{ f.label }}</label> }
                  @case ('textarea') { <label class="label" [for]="f.key">{{ f.label }}</label><textarea [id]="f.key" [name]="f.key" rows="4" class="input" [(ngModel)]="values[f.key]"></textarea> }
                  @case ('color') { <label class="label" [for]="f.key">{{ f.label }}</label><input [id]="f.key" type="color" [name]="f.key" class="h-11 w-20 rounded border" [(ngModel)]="values[f.key]" /> }
                  @case ('image') { <span class="label">{{ f.label }}</span><app-image-input [name]="f.key" folder="branding" [(ngModel)]="values[f.key]" /> }
                  @case ('map') {
                    <span class="label">{{ f.label }}</span>
                    <app-map-point-picker [(value)]="mapValue" />
                  }
                  @default { <label class="label" [for]="f.key">{{ f.label }}</label><input [id]="f.key" [name]="f.key" class="input" [(ngModel)]="values[f.key]" /> }
                }
                @if (f.help) { <p class="mt-1 text-xs text-gray-500">{{ f.help }}</p> }
              </div>
            }
          </section>
        }
        @if (error()) { <p class="rounded bg-red-50 p-3 text-sm text-red-700" role="alert">{{ error() }}</p> }
        <app-form-actions>
          <button type="submit" class="btn-primary" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save settings' }}</button>
        </app-form-actions>
      </form>
    } @else {
      <div class="max-w-4xl space-y-6" aria-busy="true" aria-label="Loading settings">@for (k of [1, 2]; track k) { <div class="card grid gap-4 p-5 md:grid-cols-2"><div class="skeleton h-4 w-32 md:col-span-2"></div>@for (j of [1, 2, 3, 4]; track j) { <div class="space-y-2"><div class="skeleton h-3 w-24"></div><div class="skeleton h-11 w-full"></div></div> }</div> }</div>
    }
  `,
})
export class AdminSettings {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(Toast);
  private readonly store = inject(SettingsStore);
  protected readonly groups = GROUPS;
  protected readonly loaded = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected values: Record<string, unknown> = {};

  /** Flat setting rows re-shaped as the picker's object; writes go back per key. */
  protected get mapValue(): MapPointValue {
    return {
      map_lat: Number(this.values['map_lat'] ?? 0),
      map_lng: Number(this.values['map_lng'] ?? 0),
      map_zoom: Number(this.values['map_zoom'] ?? 15),
      map_link: String(this.values['map_link'] ?? ''),
    };
  }
  protected set mapValue(v: MapPointValue) {
    this.values = { ...this.values, ...v };
  }

  constructor() {
    this.api.settings().subscribe({
      next: (v) => {
        this.values = { ...v };
        this.loaded.set(true);
      },
      error: (e: unknown) => this.error.set(apiError(e, 'Could not load settings')),
    });
  }

  protected save(event: Event): void {
    event.preventDefault();
    const keys = GROUPS.flatMap((g) => g.fields.map((f) => f.key));
    const payload = Object.fromEntries(
      [...keys, 'map_lat', 'map_lng', 'map_zoom'].map((k) => [k, this.values[k] ?? (k === 'map_zoom' ? 15 : '')]),
    );
    this.saving.set(true);
    this.error.set(null);
    this.api.saveSettings(payload).subscribe({
      next: (v) => {
        this.values = { ...v };
        this.saving.set(false);
        this.toast.show('Settings saved');
        void this.store.load();
      },
      error: (e: unknown) => {
        this.saving.set(false);
        this.error.set(apiError(e, 'Could not save settings'));
      },
    });
  }
}
