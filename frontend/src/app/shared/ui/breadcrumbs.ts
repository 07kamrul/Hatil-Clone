import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface Crumb { label: string; link?: string[] }

@Component({
  selector: 'app-breadcrumbs',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav aria-label="Breadcrumb" class="container-x py-3 text-sm text-gray-500">
      <ol class="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap [scrollbar-width:none]">
        <li class="shrink-0"><a routerLink="/" class="inline-flex min-h-8 items-center rounded hover:text-brand focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none">Home</a></li>
        @for (c of crumbs(); track $index) {
          <li aria-hidden="true" class="shrink-0 text-gray-300">/</li>
          <li class="min-w-0" [class.shrink-0]="!$last">
            @if (c.link) { <a [routerLink]="c.link" class="inline-flex min-h-8 items-center rounded hover:text-brand focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none">{{ c.label }}</a> }
            @else { <span class="block max-w-[60vw] truncate text-gray-800 sm:max-w-md" aria-current="page" [title]="c.label">{{ c.label }}</span> }
          </li>
        }
      </ol>
    </nav>
  `,
})
export class Breadcrumbs {
  readonly crumbs = input.required<Crumb[]>();
}
