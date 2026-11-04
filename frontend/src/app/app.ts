import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Toast } from './core/toast';
import { DialogHost } from './shared/ui/dialog-host';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, DialogHost],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <router-outlet />
    <app-dialog-host />
    <div class="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 flex-col gap-2" aria-live="polite">
      @for (m of toast.messages(); track m.id) {
        <div class="pointer-events-auto rounded-md px-4 py-2 text-sm text-white shadow-lg"
             [class]="m.kind === 'error' ? 'bg-red-600' : 'bg-gray-900'">{{ m.text }}</div>
      }
    </div>
  `,
})
export class App {
  protected readonly toast = inject(Toast);
}
