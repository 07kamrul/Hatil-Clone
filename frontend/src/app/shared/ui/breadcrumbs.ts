import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface Crumb { label: string; link?: string[] }

@Component({
  selector: 'app-breadcrumbs',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav aria-label="Breadcrumb" class="container-x py-3 text-sm text-gray-500">
      <ol class="flex flex-wrap items-center gap-1.5">
        <li><a routerLink="/" class="hover:text-brand">Home</a></li>
        @for (c of crumbs(); track $index) {
          <li aria-hidden="true">/</li>
          <li>
            @if (c.link) { <a [routerLink]="c.link" class="hover:text-brand">{{ c.label }}</a> }
            @else { <span class="text-gray-800" aria-current="page">{{ c.label }}</span> }
          </li>
        }
      </ol>
    </nav>
  `,
})
export class Breadcrumbs {
  readonly crumbs = input.required<Crumb[]>();
}
