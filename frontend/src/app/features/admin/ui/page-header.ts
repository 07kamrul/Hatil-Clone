import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Page heading with optional subtitle and projected action buttons. */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h1 class="truncate text-xl font-bold text-gray-900 sm:text-2xl">{{ title() }}</h1>
        @if (subtitle()) { <p class="mt-0.5 text-sm text-gray-500">{{ subtitle() }}</p> }
      </div>
      <div class="flex shrink-0 items-center gap-2"><ng-content select="[actions]" /></div>
    </div>
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
}
