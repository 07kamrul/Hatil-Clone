import { ChangeDetectionStrategy, Component, Injectable, inject, signal } from '@angular/core';

interface ConfirmRequest { title: string; message: string; confirmLabel: string; danger: boolean }

/**
 * Promise-based confirmation dialog. The host component must be rendered once
 * (the admin layout mounts it); `confirm()` resolves with the user's choice.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  /** Public so the dialog host component can bind to it in its template. */
  readonly state = signal<ConfirmRequest | null>(null);
  private resolve: ((ok: boolean) => void) | null = null;

  confirm(title: string, message: string, opts: { confirmLabel?: string; danger?: boolean } = {}): Promise<boolean> {
    this.resolve?.(false); // a pending dialog is implicitly cancelled
    return new Promise<boolean>((resolve) => {
      this.resolve = resolve;
      this.state.set({ title, message, confirmLabel: opts.confirmLabel ?? 'Confirm', danger: opts.danger ?? false });
    });
  }

  /** Public: invoked from the host component's template event bindings. */
  answer(ok: boolean): void {
    this.state.set(null);
    this.resolve?.(ok);
    this.resolve = null;
  }
}

@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (confirm.state(); as req) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4" (click)="onBackdrop($event)">
        <div
          role="alertdialog"
          aria-modal="true"
          [attr.aria-label]="req.title"
          class="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl"
          (keydown.escape)="confirm.answer(false)"
        >
          <h2 class="text-base font-semibold text-gray-900">{{ req.title }}</h2>
          <p class="mt-2 text-sm text-gray-600">{{ req.message }}</p>
          <div class="mt-4 flex justify-end gap-2">
            <button type="button" class="btn-outline" (click)="confirm.answer(false)">Cancel</button>
            <button
              type="button"
              class="btn"
              [class.btn-danger]="req.danger"
              [class.btn-primary]="!req.danger"
              (click)="confirm.answer(true)"
            >{{ req.confirmLabel }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialog {
  protected readonly confirm = inject(ConfirmService);

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.confirm.answer(false);
  }
}
