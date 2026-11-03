import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Toast } from '../../../core/toast';
import { AdminApi, Row, apiError } from '../core/admin-api';
import { RESOURCES } from './resource-config';

const PAGE_SIZE = 25;

@Component({
  selector: 'app-resource-list',
  imports: [RouterLink, FormsModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-bold">{{ def().title }}</h1>
      <a [routerLink]="['new']" class="btn-primary">+ New {{ def().singular }}</a>
    </div>
    <input type="search" class="input mb-4 max-w-sm" placeholder="Search…" [ngModel]="q()" (ngModelChange)="q.set($event); page.set(1)" aria-label="Search" />
    <div class="overflow-x-auto rounded-lg border bg-white">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 text-left">
          <tr>
            @for (c of def().columns; track c.key) { <th class="px-3 py-2 font-medium">{{ c.label }}</th> }
            <th class="px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows.value()?.items; track row.id) {
            <tr class="border-t hover:bg-gray-50">
              @for (c of def().columns; track c.key) {
                <td class="px-3 py-2">
                  @switch (c.type) {
                    @case ('image') { @if (row[c.key]) { <img [src]="row[c.key]" alt="" class="h-10 w-16 rounded object-cover" /> } }
                    @case ('bool') { <span [class]="row[c.key] ? 'text-green-700' : 'text-gray-400'">{{ row[c.key] ? 'Yes' : 'No' }}</span> }
                    @case ('date') { {{ $any(row[c.key]) | date: 'mediumDate' }} }
                    @case ('color') { <span class="inline-block h-5 w-5 rounded-full border" [style.background]="row[c.key]"></span> }
                    @default { {{ row[c.key] }} }
                  }
                </td>
              }
              <td class="space-x-3 whitespace-nowrap px-3 py-2 text-right">
                @if (def().viewPrefix && row['slug']) { <a [href]="(def().viewPrefix ?? '') + row['slug']" target="_blank" class="text-gray-600 hover:underline">View</a> }
                <a [routerLink]="[row.id]" class="text-brand hover:underline">Edit</a>
                <button type="button" class="text-red-600 hover:underline" (click)="remove(row)">Delete</button>
              </td>
            </tr>
          } @empty {
            <tr><td class="px-3 py-8 text-center text-gray-500" [attr.colspan]="def().columns.length + 1">
              {{ rows.isLoading() ? 'Loading…' : 'Nothing here yet.' }}</td></tr>
          }
        </tbody>
      </table>
    </div>
    @if ((rows.value()?.pages ?? 0) > 1) {
      <div class="mt-4 flex items-center gap-3 text-sm">
        <button type="button" class="btn-outline" [disabled]="page() <= 1" (click)="page.set(page() - 1)">Prev</button>
        <span>Page {{ page() }} of {{ rows.value()?.pages }}</span>
        <button type="button" class="btn-outline" [disabled]="page() >= (rows.value()?.pages ?? 1)" (click)="page.set(page() + 1)">Next</button>
      </div>
    }
  `,
})
export class ResourceList {
  /** Route data key into RESOURCES (bound via withComponentInputBinding). */
  readonly resource = input.required<string>();
  private readonly api = inject(AdminApi);
  private readonly toast = inject(Toast);

  protected readonly def = computed(() => RESOURCES[this.resource()]);
  protected readonly q = signal('');
  protected readonly page = signal(1);
  protected readonly rows = rxResource({
    params: () => ({ api: this.def().api, q: this.q(), page: this.page() }),
    stream: ({ params }) => this.api.list<Row>(params.api, { q: params.q, page: params.page, page_size: PAGE_SIZE }),
  });

  protected remove(row: Row): void {
    const label = String(row['name'] ?? row['title'] ?? row['question'] ?? `#${row.id}`);
    if (!confirm(`Delete "${label}"? This cannot be undone.`)) return;
    this.api.remove(this.def().api, row.id).subscribe({
      next: () => {
        this.toast.show('Deleted');
        this.rows.reload();
      },
      error: (err: unknown) => this.toast.error(apiError(err)),
    });
  }
}
