import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { Toast } from '../../../core/toast';
import { AdminApi, Row, apiError } from '../core/admin-api';
import { HtmlEditor } from '../ui/html-editor';
import { ImageInput } from '../ui/image-input';
import { DEFAULTS, FieldDef, RESOURCES } from './resource-config';

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

@Component({
  selector: 'app-resource-form',
  imports: [FormsModule, RouterLink, HtmlEditor, ImageInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a [routerLink]="['..']" class="text-sm text-gray-600 hover:underline">← Back to {{ def().title }}</a>
    <h1 class="mb-5 mt-2 text-2xl font-bold">{{ isNew() ? 'New ' + def().singular : 'Edit ' + def().singular }}</h1>
    @if (loading()) { <p class="text-gray-500">Loading…</p> }
    @else {
      <form class="card max-w-3xl space-y-4 p-6" (submit)="save($event)">
        @for (f of def().fields; track f.key) {
          <div>
            @if (f.type === 'checkbox') {
              <label class="flex items-center gap-2 text-sm font-medium"><input type="checkbox" [name]="f.key" [(ngModel)]="model[f.key]" /> {{ f.label }}</label>
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
                @case ('datetime') { <input [id]="'f-' + f.key" type="datetime-local" [name]="f.key" class="input" [(ngModel)]="model[f.key]" /> }
                @case ('color') { <input [id]="'f-' + f.key" type="color" [name]="f.key" class="h-10 w-20 rounded border" [(ngModel)]="model[f.key]" /> }
                @default { <input [id]="'f-' + f.key" type="text" [name]="f.key" class="input" [(ngModel)]="model[f.key]" [required]="!!f.required" /> }
              }
            }
            @if (f.help) { <p class="mt-1 text-xs text-gray-500">{{ f.help }}</p> }
          </div>
        }
        @if (error()) { <p class="rounded bg-red-50 p-3 text-sm text-red-700" role="alert">{{ error() }}</p> }
        <div class="flex gap-3">
          <button type="submit" class="btn-primary" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save' }}</button>
          <a [routerLink]="['..']" class="btn-outline">Cancel</a>
        </div>
      </form>
    }
  `,
})
export class ResourceForm {
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
          this.model = Object.fromEntries(def.fields.map((f) => [f.key, f.type === 'datetime' ? toLocalInput(row[f.key]) : (row[f.key] ?? DEFAULTS[f.type])]));
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
    for (const f of this.def().fields) out[f.key] = this.normalize(f, this.model[f.key]);
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
