import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  viewChild,
} from '@angular/core';

import { Dialog, type DialogKind } from '../../core/dialog';

const KIND_STYLES: Record<
  DialogKind,
  { ring: string; icon: string; iconColor: string; btn: string }
> = {
  info: { ring: 'bg-blue-100', icon: 'i', iconColor: 'text-blue-600', btn: 'btn-primary' },
  success: { ring: 'bg-green-100', icon: '✓', iconColor: 'text-green-600', btn: 'btn-primary' },
  warning: { ring: 'bg-amber-100', icon: '!', iconColor: 'text-amber-600', btn: 'btn-primary' },
  danger: { ring: 'bg-red-100', icon: '✕', iconColor: 'text-red-600', btn: 'btn-danger' },
};

/** Renders the `Dialog` service's current request. Mounted once in `App`. */
@Component({
  selector: 'app-dialog-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (dialog.state(); as req) {
      <div
        class="fixed inset-0 z-[90] flex items-end justify-center bg-gray-900/50 p-0 backdrop-blur-sm motion-safe:animate-dialog-backdrop sm:items-center sm:p-4"
        (click)="onBackdrop($event)"
      >
        <div
          #panel
          role="alertdialog"
          aria-modal="true"
          [attr.aria-label]="req.title"
          (keydown)="onKeydown($event)"
          class="w-full rounded-t-2xl bg-white p-5 shadow-xl motion-safe:animate-dialog-panel sm:max-w-sm sm:rounded-2xl"
        >
          <div class="flex items-start gap-3">
            <div
              class="flex size-10 shrink-0 items-center justify-center rounded-full text-lg font-bold"
              [class]="styles().ring"
              aria-hidden="true"
            >
              <span [class]="styles().iconColor">{{ styles().icon }}</span>
            </div>
            <div class="min-w-0 flex-1">
              <h2 class="text-base font-semibold text-gray-900">{{ req.title }}</h2>
              @if (req.message) {
                <p class="mt-1 text-sm text-gray-600">{{ req.message }}</p>
              }
            </div>
          </div>

          @if (req.mode === 'prompt') {
            <input
              #promptInput
              type="text"
              class="mt-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              [attr.placeholder]="req.placeholder || ''"
              [value]="req.value"
              (input)="onInput(promptInput.value)"
              (keydown.enter)="onPromptEnter()"
            />
            @if (error()) {
              <p class="mt-1 text-xs text-red-600">{{ error() }}</p>
            }
          }

          <div class="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            @if (req.mode !== 'alert') {
              <button
                type="button"
                #cancelBtn
                class="btn-outline w-full sm:w-auto"
                (click)="cancel()"
              >
                Cancel
              </button>
            }
            <button
              type="button"
              #confirmBtn
              class="btn w-full sm:w-auto"
              [class]="styles().btn"
              [disabled]="req.mode === 'prompt' && !!error()"
              (click)="confirmAction()"
            >
              {{ req.confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class DialogHost {
  protected readonly dialog = inject(Dialog);

  protected readonly styles = computed(() => KIND_STYLES[this.dialog.state()?.kind ?? 'info']);

  protected readonly error = computed(() => {
    const req = this.dialog.state();
    if (req?.mode !== 'prompt' || !req.validate) return '';
    return req.validate(req.value);
  });

  private readonly promptInput = viewChild<ElementRef<HTMLInputElement>>('promptInput');
  private readonly cancelBtn = viewChild<ElementRef<HTMLButtonElement>>('cancelBtn');
  private readonly confirmBtn = viewChild<ElementRef<HTMLButtonElement>>('confirmBtn');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  constructor() {
    // Focus + scroll lock react to every dialog opening; cleared when it closes.
    // Effects also run during SSR, so skip browser-only DOM access on the server.
    effect(() => {
      if (typeof document === 'undefined') return;
      const req = this.dialog.state();
      if (!req) {
        document.body.style.overflow = '';
        return;
      }
      document.body.style.overflow = 'hidden';
      // Focus the safest control: the input on prompt, Cancel on danger, else Confirm.
      setTimeout(() => {
        if (!this.dialog.state()) return;
        const target =
          req.mode === 'prompt'
            ? this.promptInput()?.nativeElement
            : req.kind === 'danger'
              ? this.cancelBtn()?.nativeElement
              : this.confirmBtn()?.nativeElement;
        target?.focus();
        if (target instanceof HTMLInputElement) target.select();
      });
    });
    inject(DestroyRef).onDestroy(() => {
      if (typeof document !== 'undefined') document.body.style.overflow = '';
    });
  }

  protected onInput(value: string): void {
    const req = this.dialog.state();
    if (req) this.dialog.state.set({ ...req, value });
  }

  protected onPromptEnter(): void {
    if (!this.error()) this.confirmAction();
  }

  protected onKeydown(event: KeyboardEvent): void {
    const req = this.dialog.state();
    if (!req) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancel();
    } else if (event.key === 'Enter' && req.mode === 'alert') {
      event.preventDefault();
      this.confirmAction();
    } else if (event.key === 'Tab') {
      this.trapFocus(event);
    }
  }

  protected cancel(): void {
    this.dialog.answer(null);
  }

  protected confirmAction(): void {
    const req = this.dialog.state();
    if (!req) return;
    if (req.mode === 'prompt' && this.error()) return;
    this.dialog.answer(req.mode === 'prompt' ? req.value : 'ok');
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.cancel();
  }

  private trapFocus(event: KeyboardEvent): void {
    const host = this.panel()?.nativeElement;
    if (!host) return;
    const focusables = [...host.querySelectorAll<HTMLElement>('button, input')];
    if (focusables.length === 0) return;
    const active = document.activeElement as HTMLElement | null;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const inside = active !== null && focusables.includes(active);
    if (event.shiftKey && (!inside || active === first)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (!inside || active === last)) {
      event.preventDefault();
      first.focus();
    }
  }
}
