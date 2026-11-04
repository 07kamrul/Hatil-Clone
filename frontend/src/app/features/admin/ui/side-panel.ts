import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, inject, input, output } from '@angular/core';

import { Dialog } from '../../../core/dialog';

/**
 * Slide-in panel: full-screen sheet on mobile, 28rem sidebar on desktop.
 * Projected content is the panel body; emits `closed` on Esc or backdrop click.
 */
@Component({
  selector: 'app-side-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'onEscape()' },
  template: `
    <div class="fixed inset-0 z-40 bg-gray-900/50" (click)="closed.emit()" aria-hidden="true"></div>
    <aside
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      [attr.aria-label]="label()"
      class="fixed inset-0 z-50 flex w-full flex-col bg-white shadow-xl md:left-auto md:max-w-[28rem] md:border-l md:border-gray-200"
      [style.padding-bottom]="'env(safe-area-inset-bottom)'"
    >
      <ng-content />
    </aside>
  `,
})
export class SidePanel {
  readonly closed = output<void>();
  readonly label = input('Panel');
  private readonly dialog = inject(Dialog);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('[role=dialog]')?.focus());
  }

  /** Esc cancels a confirm/prompt dialog on top first, so it must not also discard the panel. */
  protected onEscape(): void {
    if (this.dialog.state()) return;
    this.closed.emit();
  }
}
