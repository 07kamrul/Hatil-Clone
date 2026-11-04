import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CategoryNode } from '../../core/models';
import { Icon } from '../ui/icon';
import { splitNav } from './nav-split';

const MORE_ID = -1;

/** Desktop single-line nav (Title Case) with hover mega panels and a "More" overflow menu. */
@Component({
  selector: 'app-mega-menu',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav aria-label="Product categories" (mouseleave)="active.set(null)">
      <ul class="flex items-center justify-center">
        @for (item of split().visible; track item.node.id) {
          <li
            (mouseenter)="active.set(item.node.id)"
            [class]="item.isWideOnly ? 'hidden 2xl:block' : ''"
          >
            <a
              [routerLink]="['/category', item.node.slug]"
              (focus)="active.set(item.node.id)"
              (click)="close()"
              class="nav-link"
              [class.is-active]="active() === item.node.id"
              >{{ item.node.name }}</a
            >
          </li>
        }
        <li class="relative" (mouseenter)="active.set(moreId)">
          <button
            type="button"
            class="nav-link inline-flex items-center gap-0.5"
            [class.is-active]="active() === moreId"
            [attr.aria-expanded]="active() === moreId"
            aria-haspopup="true"
            (click)="active.set(active() === moreId ? null : moreId)"
          >
            More <app-icon name="chevronDown" [size]="14" />
          </button>
          @if (active() === moreId) {
            <ul
              class="absolute right-0 top-full z-50 w-60 rounded-b-md border-t-2 border-brand bg-white py-2 shadow-xl"
            >
              @for (item of split().overflow; track item.node.id) {
                <li [class]="item.isWideOnly ? '2xl:hidden' : ''">
                  <a
                    [routerLink]="['/category', item.node.slug]"
                    (click)="close()"
                    class="more-link"
                    >{{ item.node.name }}</a
                  >
                </li>
              }
              <li><a routerLink="/showrooms" (click)="close()" class="more-link">Showrooms</a></li>
              <li><a routerLink="/blog" (click)="close()" class="more-link">Inspiration</a></li>
              <li><a routerLink="/compare" (click)="close()" class="more-link">Compare</a></li>
              <li><a routerLink="/contact" (click)="close()" class="more-link">Contact</a></li>
            </ul>
          }
        </li>
      </ul>
      @for (top of tree(); track top.id) {
        @if (active() === top.id && top.children.length) {
          <div class="absolute inset-x-0 top-full z-40 border-t bg-white shadow-xl">
            <div class="container-x grid grid-cols-2 gap-8 py-8 lg:grid-cols-5">
              @for (cat of top.children; track cat.id) {
                <div>
                  <a
                    [routerLink]="['/category', cat.slug]"
                    (click)="close()"
                    class="mb-2 block font-semibold text-gray-900 hover:text-brand"
                    >{{ cat.name }}</a
                  >
                  <ul class="space-y-1.5">
                    @for (sub of cat.children; track sub.id) {
                      <li>
                        <a
                          [routerLink]="['/category', sub.slug]"
                          (click)="close()"
                          class="text-sm text-gray-600 hover:text-brand"
                          >{{ sub.name }}</a
                        >
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
  styles: `
    .nav-link {
      display: block;
      padding: 0 0.9rem;
      line-height: var(--header-h, 88px);
      font-size: 1.05rem;
      font-weight: 500;
      color: #1f2937;
      white-space: nowrap;
      transition:
        color 0.15s,
        line-height 0.2s;
    }
    .nav-link:hover,
    .nav-link.is-active {
      color: var(--color-brand);
    }
    .more-link {
      display: block;
      padding: 0.5rem 1rem;
      font-size: 0.95rem;
      color: #374151;
    }
    .more-link:hover {
      background: #f9fafb;
      color: var(--color-brand);
    }
  `,
})
export class MegaMenu {
  readonly tree = input.required<CategoryNode[]>();
  readonly navigated = output<void>();
  protected readonly moreId = MORE_ID;
  protected readonly active = signal<number | null>(null);
  protected readonly split = computed(() => splitNav(this.tree()));

  protected close(): void {
    this.active.set(null);
    this.navigated.emit();
  }
}
