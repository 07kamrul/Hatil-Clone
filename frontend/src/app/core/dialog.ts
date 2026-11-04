import { Injectable, signal } from '@angular/core';

export type DialogKind = 'info' | 'success' | 'warning' | 'danger';

export interface DialogOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  kind?: DialogKind;
  /** Only used by prompt(): placeholder for the input. */
  placeholder?: string;
  /** Only used by prompt(): return an error string while invalid, '' when valid. */
  validate?: (value: string) => string;
}

interface DialogRequest extends DialogOptions {
  kind: DialogKind;
  mode: 'confirm' | 'alert' | 'prompt';
  confirmLabel: string;
  cancelLabel: string;
  value: string;
}

type Resolver = (result: string | null) => void;

const KIND_DEFAULTS: Record<DialogKind, { confirmLabel: string }> = {
  info: { confirmLabel: 'Confirm' },
  success: { confirmLabel: 'OK' },
  warning: { confirmLabel: 'Continue' },
  danger: { confirmLabel: 'Delete' },
};

/**
 * Promise-based popup dialogs (confirm / alert / prompt) shared by the whole
 * app; the host component is mounted once in `App`. A second request waits in
 * a queue instead of cancelling the first.
 */
@Injectable({ providedIn: 'root' })
export class Dialog {
  /** Public: the dialog host component binds to this in its template. */
  readonly state = signal<DialogRequest | null>(null);

  private readonly queue: {
    request: DialogRequest;
    resolve: Resolver;
  }[] = [];
  private resolve: Resolver | null = null;
  private opener: HTMLElement | null = null;

  confirm(title: string, message: string, opts: Partial<DialogOptions> = {}): Promise<boolean> {
    return this.open({ ...opts, title, message, mode: 'confirm' }).then((r) => r !== null);
  }

  alert(title: string, message: string, opts: Partial<DialogOptions> = {}): Promise<void> {
    return this.open({ ...opts, title, message, mode: 'alert' }).then(() => undefined);
  }

  prompt(title: string, opts: Partial<DialogOptions> = {}): Promise<string | null> {
    return this.open({ ...opts, title, mode: 'prompt' });
  }

  /** Public: invoked from the host component's template event bindings. */
  answer(value: string | null): void {
    this.state.set(null);
    this.resolve?.(value);
    this.resolve = null;
    const next = this.queue.shift();
    if (next) this.show(next.request, next.resolve);
    else {
      const opener = this.opener;
      this.opener = null;
      queueMicrotask(() => opener?.focus());
    }
  }

  private open(opts: DialogOptions & { mode: DialogRequest['mode'] }): Promise<string | null> {
    const kind = opts.kind ?? 'info';
    const request: DialogRequest = {
      ...opts,
      kind,
      confirmLabel: opts.confirmLabel ?? KIND_DEFAULTS[kind].confirmLabel,
      cancelLabel: opts.cancelLabel ?? 'Cancel',
      value: '',
    };
    return new Promise((resolve) => {
      if (this.state()) this.queue.push({ request, resolve });
      else this.show(request, resolve);
    });
  }

  private show(request: DialogRequest, resolve: Resolver): void {
    if (!this.opener && typeof document !== 'undefined') {
      this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    this.resolve = resolve;
    this.state.set(request);
  }
}
