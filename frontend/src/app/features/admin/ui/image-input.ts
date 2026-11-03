import { ChangeDetectionStrategy, Component, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { AdminApi, apiError } from '../core/admin-api';

/** Uploads an image to /admin/uploads/image and stores the resulting URL as the control value. */
@Component({
  selector: 'app-image-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ImageInput), multi: true }],
  template: `
    <div class="flex items-start gap-3">
      <div class="flex h-24 w-32 shrink-0 items-center justify-center overflow-hidden rounded border bg-gray-50">
        @if (value()) { <img [src]="value()" alt="" class="h-full w-full object-cover" /> } @else { <span class="text-xs text-gray-400">No image</span> }
      </div>
      <div class="space-y-2 text-sm">
        <label class="btn-outline cursor-pointer">
          {{ uploading() ? 'Uploading…' : value() ? 'Replace' : 'Upload' }}
          <input type="file" accept="image/*" class="hidden" [disabled]="uploading()" (change)="upload($event)" />
        </label>
        @if (value()) { <button type="button" class="block text-red-600 hover:underline" (click)="set(null)">Remove</button> }
        @if (error()) { <p class="text-xs text-red-600">{{ error() }}</p> }
      </div>
    </div>
  `,
})
export class ImageInput implements ControlValueAccessor {
  readonly folder = input('misc');
  private readonly api = inject(AdminApi);
  protected readonly value = signal<string | null>(null);
  protected readonly uploading = signal(false);
  protected readonly error = signal<string | null>(null);
  private onChange: (value: string | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: string | null): void { this.value.set(value || null); }
  registerOnChange(fn: (value: string | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }

  protected set(value: string | null): void {
    this.value.set(value);
    this.onChange(value);
    this.onTouched();
  }

  protected upload(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file) return;
    this.uploading.set(true);
    this.error.set(null);
    this.api.uploadImage(file, this.folder()).subscribe({
      next: (res) => {
        this.uploading.set(false);
        this.set(res.url);
      },
      error: (err: unknown) => {
        this.uploading.set(false);
        this.error.set(apiError(err, 'Upload failed'));
      },
    });
  }
}
