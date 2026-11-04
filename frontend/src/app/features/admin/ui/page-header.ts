import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Page heading with optional subtitle and projected action buttons. */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
      <div class="min-w-0 flex-1">
        <h1 class="break-words text-xl font-bold text-gray-900 sm:text-2xl">{{ title() }}</h1>
        @if (subtitle()) { <p class="mt-0.5 text-sm text-gray-500">{{ subtitle() }}</p> }
      </div>
      <div class="flex min-w-0 flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end"><ng-content select="[actions]" /></div>
    </div>
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
}
