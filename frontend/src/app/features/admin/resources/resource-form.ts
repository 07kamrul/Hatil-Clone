import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { Toast } from '../../../core/toast';
import { AdminApi, Row, apiError } from '../core/admin-api';
import { HtmlEditor } from '../ui/html-editor';
import { FormActions } from '../ui/form-actions';
import { ImageInput } from '../ui/image-input';
import { MapLinkField } from '../ui/map-link-field';
import { DEFAULTS, FieldDef, MAPLINK_COORD_KEYS, RESOURCES } from './resource-config';

/** ISO datetime ⇄ value of <input type="datetime-local"> (local time, no seconds). */
export function toLocalInput(iso: unknown): string {
  if (typeof iso !== 'string' || !iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Field types that span both columns of the md+ grid. */
const WIDE_TYPES = new Set(['textarea', 'html', 'image', 'maplink']);

/** Map a form model's coordinate keys to the API payload (empty → null, strings → numbers). */
export function maplinkCoords(model: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(keys.map((key) => {
    const value = model[key];
    return [key, value === '' || value === null || value === undefined ? null : Number(value)];
  }));
}

@Component({
  selector: 'app-resource-form',
  imports: [FormsModule, RouterLink, HtmlEditor, ImageInput, FormActions, MapLinkField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a [routerLink]="['..']" class="inline-flex min-h-11 items-center text-sm text-gray-600 hover:underline">← Back to {{ def().title }}</a>
    <h1 class="mb-5 break-words text-2xl font-bold">{{ isNew() ? 'New ' + def().singular : 'Edit ' + def().singular }}</h1>
    @if (loading()) {
      <div class="card max-w-3xl space-y-4 p-6" aria-busy="true" aria-label="Loading">@for (k of [1, 2, 3, 4]; track k) { <div class="space-y-2"><div class="skeleton h-3 w-24"></div><div class="skeleton h-11 w-full"></div></div> }</div>
    }
    @else {
      <form class="card grid max-w-4xl gap-4 p-4 sm:p-6 md:grid-cols-2" (submit)="save($event)">
        @for (f of def().fields; track f.key) {
          <div class="min-w-0" [class.md:col-span-2]="isWide(f.type)">
            @if (f.type === 'checkbox') {
              <label class="flex min-h-11 items-center gap-2 text-sm font-medium"><input type="checkbox" class="h-5 w-5" [name]="f.key" [(ngModel)]="model[f.key]" /> {{ f.label }}</label>
            } @else {
              <label class="label" [for]="'f-' + f.key">{{ f.label }}@if (f.required) { <span class="text-red-600">*</span> }</label>
              @switch (f.type) {
                @case ('textarea') { <textarea [id]="'f-' + f.key" [name]="f.key" rows="3" class="input" [(ngModel)]="model[f.key]" [required]="!!f.required"></textarea> }
                @case ('html') { <app-html-editor [name]="f.key" [(ngModel)]="model[f.key]" /> }
                @case ('number') { <input [id]="'f-' + f.key" type="number" [step]="f.step || '1'" [name]="f.key" class="input" [(ngModel)]="model[f.key]" /> }
                @case ('select') {
                  <select [id]="'f-' + f.key" [name]="f.key" class="input" [(ngModel)]="model[f.key]">
                    @for (o of f.options; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
                  </select>
                }
                @case ('image') { <app-image-input [name]="f.key" [folder]="f.folder || 'misc'" [(ngModel)]="model[f.key]" /> }
                @case ('maplink') { <app-map-link-field [model]="model" /> }
                @case ('datetime') { <input [id]="'f-' + f.key" type="datetime-local" [name]="f.key" class="input" [(ngModel)]="model[f.key]" /> }
                @case ('color') { <input [id]="'f-' + f.key" type="color" [name]="f.key" class="h-11 w-20 rounded border" [(ngModel)]="model[f.key]" /> }
                @default { <input [id]="'f-' + f.key" type="text" [name]="f.key" class="input" [(ngModel)]="model[f.key]" [required]="!!f.required" /> }
              }
            }
            @if (f.help) { <p class="mt-1 text-xs text-gray-500">{{ f.help }}</p> }
          </div>
        }
        @if (error()) { <p class="rounded bg-red-50 p-3 text-sm text-red-700 md:col-span-2" role="alert">{{ error() }}</p> }
        <app-form-actions class="md:col-span-2">
          <button type="submit" class="btn-primary" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save' }}</button>
          <a [routerLink]="['..']" class="btn-outline">Cancel</a>
        </app-form-actions>
      </form>
    }
  `,
})
export class ResourceForm {
  protected isWide(type: string): boolean {
    return WIDE_TYPES.has(type);
  }

  readonly resource = input.required<string>();
  /** Route param: numeric id or "new". */
  readonly id = input<string>('new');

  private readonly api = inject(AdminApi);
  private readonly router = inject(Router);
  private readonly toast = inject(Toast);

  protected readonly def = computed(() => RESOURCES[this.resource()]);
  protected readonly isNew = computed(() => this.id() === 'new');
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected model: Record<string, unknown> = {};

  constructor() {
    effect(() => {
      const def = this.def();
      this.model = Object.fromEntries(def.fields.map((f) => [f.key, f.type === 'checkbox' && /active|published|footer/.test(f.key) ? true : f.type === 'select' ? f.options?.[0]?.value : DEFAULTS[f.type]]));
      if (this.isNew()) return;
      this.loading.set(true);
      this.api.get<Row>(def.api, Number(this.id())).subscribe({
        next: (row) => {
          const model = Object.fromEntries(def.fields.map((f) => [f.key, f.type === 'datetime' ? toLocalInput(row[f.key]) : (row[f.key] ?? DEFAULTS[f.type])]));
          if (def.fields.some((f) => f.type === 'maplink')) {
            for (const key of MAPLINK_COORD_KEYS) model[key] = row[key] ?? null;
          }
          this.model = model;
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.error.set(apiError(err, 'Could not load record'));
        },
      });
    });
  }

  private payload(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const f of this.def().fields) {
      // maplink fields carry no payload of their own; they write into the coordinate keys instead.
      if (f.type === 'maplink') continue;
      out[f.key] = this.normalize(f, this.model[f.key]);
    }
    if (this.def().fields.some((f) => f.type === 'maplink')) {
      Object.assign(out, maplinkCoords(this.model, MAPLINK_COORD_KEYS));
    }
    return out;
  }

  private normalize(f: FieldDef, value: unknown): unknown {
    if (f.type === 'datetime') return fromLocalInput(value);
    if (f.type === 'number') return value === '' || value === null || value === undefined ? (f.key === 'sort_order' ? 0 : null) : Number(value);
    if (f.type === 'checkbox') return !!value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed === '' && !f.required && f.type !== 'html' ? null : trimmed;
    }
    return value ?? null;
  }

  protected save(event: Event): void {
    event.preventDefault();
    const missing = this.def().fields.filter((f) => f.required && !this.model[f.key]);
    if (missing.length) {
      this.error.set(`Please fill in: ${missing.map((f) => f.label).join(', ')}`);
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    const def = this.def();
    const request = this.isNew() ? this.api.create(def.api, this.payload()) : this.api.update(def.api, Number(this.id()), this.payload());
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.show(`${def.singular[0].toUpperCase()}${def.singular.slice(1)} saved`);
        void this.router.navigate(['/admin', def.key]);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(apiError(err, 'Could not save'));
      },
    });
  }
}
