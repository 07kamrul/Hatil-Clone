import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CategoryNode } from '../../core/models';
import { Icon } from '../ui/icon';

/** Desktop mega-menu: top-level (room) → category → subcategory. */
@Component({
  selector: 'app-mega-menu',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav aria-label="Product categories" class="relative" (mouseleave)="active.set(null)">
      <ul class="flex flex-wrap items-center gap-x-1">
        @for (top of tree(); track top.id) {
          <li (mouseenter)="active.set(top.id)">
            <a [routerLink]="['/category', top.slug]" (focus)="active.set(top.id)" (click)="active.set(null)"
               class="inline-flex items-center gap-1 px-3 py-3 text-sm font-medium uppercase tracking-wide hover:text-brand"
               [class.text-brand]="active() === top.id">
              {{ top.name }}
              @if (top.children.length) { <app-icon name="chevronDown" [size]="14" /> }
            </a>
          </li>
        }
        <li><a routerLink="/showrooms" class="px-3 py-3 text-sm font-medium uppercase tracking-wide hover:text-brand">Showrooms</a></li>
        <li><a routerLink="/blog" class="px-3 py-3 text-sm font-medium uppercase tracking-wide hover:text-brand">Inspiration</a></li>
      </ul>
      @for (top of tree(); track top.id) {
        @if (active() === top.id && top.children.length) {
          <div class="absolute left-0 right-0 top-full z-40 border-t bg-white shadow-xl">
            <div class="container-x grid grid-cols-2 gap-6 py-6 lg:grid-cols-4">
              @for (cat of top.children; track cat.id) {
                <div>
                  <a [routerLink]="['/category', cat.slug]" (click)="navigated.emit(); active.set(null)"
                     class="mb-2 block font-semibold text-gray-900 hover:text-brand">{{ cat.name }}</a>
                  <ul class="space-y-1">
                    @for (sub of cat.children; track sub.id) {
                      <li>
                        <a [routerLink]="['/category', sub.slug]" (click)="navigated.emit(); active.set(null)"
                           class="text-sm text-gray-600 hover:text-brand">{{ sub.name }}</a>
                      </li>
                    }
                  </ul>
                </div>
              }
            </div>
          </div>
        }
      }
    </nav>
  `,
})
export class MegaMenu {
  readonly tree = input.required<CategoryNode[]>();
  readonly navigated = output<void>();
  protected readonly active = signal<number | null>(null);
}
