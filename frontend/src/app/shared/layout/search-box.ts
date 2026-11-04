import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';

import { Api } from '../../core/api';
import { Suggestion } from '../../core/models';
import { Icon } from '../ui/icon';
import { MoneyPipe } from '../ui/money-pipe';

const DEBOUNCE_MS = 250;
const MIN_QUERY = 2;

@Component({
  selector: 'app-search-box',
  imports: [FormsModule, RouterLink, Icon, MoneyPipe, NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:click)': 'onDocumentClick($event)', class: 'relative block w-full' },
  template: `
    <form (submit)="submit($event)" role="search" class="flex">
      <input type="search" name="q" [ngModel]="query()" (ngModelChange)="onInput($event)" (focus)="open.set(true)"
             (keydown.escape)="open.set(false)" placeholder="Search furniture, e.g. sofa, bed, table…"
             aria-label="Search products" autocomplete="off" class="input min-w-0 rounded-r-none" />
      <button type="submit" aria-label="Search" class="min-h-11 min-w-11 rounded-r-md bg-brand px-3 text-white hover:bg-brand-dark focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none">
        <app-icon name="search" />
      </button>
    </form>
    @if (open() && suggestions().length) {
      <ul class="absolute left-0 right-0 top-full z-50 mt-1 max-h-[60dvh] overflow-auto overscroll-contain rounded-md border border-gray-200 bg-white shadow-lg">
        @for (s of suggestions(); track s.type + s.slug) {
          <li>
            <a [routerLink]="link(s)" (click)="close()" class="flex min-h-12 items-center gap-3 px-3 py-2 hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none">
              @if (s.image) {
                <img [ngSrc]="s.image" [alt]="s.name" width="40" height="40" class="h-10 w-10 rounded object-cover" />
              } @else {
                <span class="flex h-10 w-10 items-center justify-center rounded bg-gray-100 text-xs text-gray-400">
                  {{ s.type === 'category' ? 'Cat' : '—' }}
                </span>
              }
              <span class="min-w-0 flex-1 truncate text-sm">{{ s.name }}
                @if (s.type === 'category') { <span class="ml-1 text-xs text-gray-500">in categories</span> }
              </span>
              @if (s.price !== null) { <span class="shrink-0 text-sm font-medium text-brand">{{ s.price | money }}</span> }
            </a>
          </li>
        }
      </ul>
    }
  `,
})
export class SearchBox {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly input$ = new Subject<string>();

  protected readonly query = signal('');
  protected readonly open = signal(false);
  protected readonly suggestions = toSignal(
    this.input$.pipe(
      map((q) => q.trim()),
      debounceTime(DEBOUNCE_MS),
      distinctUntilChanged(),
      switchMap((q) => (q.length < MIN_QUERY ? of<Suggestion[]>([]) : this.api.search(q).pipe(catchError(() => of<Suggestion[]>([]))))),
    ),
    { initialValue: [] as Suggestion[] },
  );

  protected onInput(value: string): void {
    this.query.set(value);
    this.open.set(true);
    this.input$.next(value);
  }

  protected link(s: Suggestion): string[] {
    return s.type === 'product' ? ['/product', s.slug] : ['/category', s.slug];
  }

  protected submit(event: Event): void {
    event.preventDefault();
    const q = this.query().trim();
    if (!q) return;
    this.close();
    void this.router.navigate(['/search'], { queryParams: { q } });
  }

  protected close(): void {
    this.open.set(false);
  }

  protected onDocumentClick(event: Event): void {
    if (!(this.el.nativeElement as HTMLElement).contains(event.target as Node)) this.open.set(false);
  }
}
