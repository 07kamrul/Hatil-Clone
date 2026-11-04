import { ChangeDetectionStrategy, Component, output } from '@angular/core';

/**
 * Slide-in panel: full-width sheet on mobile, 28rem sidebar on desktop.
 * Projected content is the panel body; emits `closed` on Esc or backdrop click.
 */
@Component({
  selector: 'app-side-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <div class="fixed inset-0 z-40 bg-gray-900/50" (click)="closed.emit()" aria-hidden="true"></div>
    <aside
      role="dialog"
      aria-modal="true"
      class="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-xl sm:max-w-[28rem]"
    >
      <ng-content />
    </aside>
  `,
})
export class SidePanel {
  readonly closed = output<void>();
}
