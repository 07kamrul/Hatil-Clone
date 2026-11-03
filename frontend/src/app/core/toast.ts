import { Injectable, signal } from '@angular/core';

export interface ToastMessage { id: number; text: string; kind: 'info' | 'error' }

const TOAST_MS = 3000;

@Injectable({ providedIn: 'root' })
export class Toast {
  private nextId = 1;
  private readonly state = signal<readonly ToastMessage[]>([]);
  readonly messages = this.state.asReadonly();

  show(text: string, kind: ToastMessage['kind'] = 'info'): void {
    const id = this.nextId++;
    this.state.update((m) => [...m, { id, text, kind }]);
    setTimeout(() => this.state.update((m) => m.filter((x) => x.id !== id)), TOAST_MS);
  }

  error(text: string): void {
    this.show(text, 'error');
  }
}
