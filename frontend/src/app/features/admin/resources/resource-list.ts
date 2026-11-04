import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Toast } from '../../../core/toast';
import { Icon } from '../../../shared/ui/icon';
import { AdminApi, Row, apiError } from '../core/admin-api';
import { Badge } from '../ui/badge';
import { ConfirmService } from '../ui/confirm-dialog';
import { PageHeader } from '../ui/page-header';
import { RESOURCES } from './resource-config';

const PAGE_SIZE = 25;

@Component({
  selector: 'app-resource-list',
  imports: [RouterLink, FormsModule, DatePipe, Icon, Badge, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="def().title">
      <a actions [routerLink]="['new']" class="btn-primary"><app-icon name="plus" [size]="16" /> New {{ def().singular }}</a>
    </app-page-header>
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <input type="search" class="input max-w-full sm:max-w-xs" placeholder="Search…" [ngModel]="q()" (ngModelChange)="q.set($event); page.set(1)" aria-label="Search" />
      @if (total() > 0) { <span class="text-sm text-gray-500">{{ total() }} {{ total() === 1 ? def().singular : def().title.toLowerCase() }}</span> }
    </div>
    @if (rows.error()) {
      <div class="card flex flex-col items-center gap-3 p-10 text-center">
        <p class="text-sm text-red-600">{{ rows.error() }}</p>
        <button type="button" class="btn-outline" (click)="rows.reload()">Retry</button>
      </div>
    } @else if (rows.isLoading()) {
      <div class="card divide-y">
        @for (i of [1, 2, 3]; track i) {
          <div class="p-4"><div class="skeleton h-3 w-1/3"></div></div>
        }
      </div>
    } @else {
      <div class="overflow-hidden rounded-lg border bg-white">
        <table class="table-admin">
          <thead>
            <tr>
              @for (c of def().columns; track c.key) { <th>{{ c.label }}</th> }
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows.value()?.items; track row.id) {
              <tr>
                @for (c of def().columns; track c.key) {
                  <td>
                    @switch (c.type) {
                      @case ('image') { @if (row[c.key]) { <img [src]="row[c.key]" alt="" class="h-10 w-16 rounded object-cover" /> } }
                      @case ('bool') { @if (row[c.key]) { <app-badge tone="green">Yes</app-badge> } @else { <app-badge tone="gray">No</app-badge> } }
                      @case ('date') { {{ $any(row[c.key]) | date: 'mediumDate' }} }
                      @case ('color') { <span class="inline-block h-5 w-5 rounded-full border" [style.background]="row[c.key]"></span> }
                      @default { {{ row[c.key] }} }
                    }
                  </td>
                }
                <td class="whitespace-nowrap text-right">
                  @if (def().viewPrefix && row['slug']) { <a [href]="(def().viewPrefix ?? '') + row['slug']" target="_blank" class="icon-btn" title="View on site" aria-label="View on site"><app-icon name="external" [size]="16" /></a> }
                  <a [routerLink]="[row.id]" class="icon-btn" title="Edit" aria-label="Edit {{ row['name'] ?? row['title'] ?? 'item' }}"><app-icon name="pencil" [size]="16" /></a>
                  <button type="button" class="icon-btn hover:bg-red-50 hover:text-red-600" title="Delete" aria-label="Delete {{ row['name'] ?? row['title'] ?? 'item' }}" (click)="remove(row)"><app-icon name="trash" [size]="16" /></button>
                </td>
              </tr>
            } @empty {
              <tr><td class="px-3 py-8 text-center text-gray-500" [attr.colspan]="def().columns.length + 1">Nothing here yet.</td></tr>
            }
          </tbody>
        </table>
      </div>
    }
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
  private readonly confirmDialog = inject(ConfirmService);

  protected readonly def = computed(() => RESOURCES[this.resource()]);
  protected readonly q = signal('');
  protected readonly page = signal(1);
  protected readonly total = computed(() => this.rows.value()?.total ?? 0);
  protected readonly rows = rxResource({
    params: () => ({ api: this.def().api, q: this.q(), page: this.page() }),
    stream: ({ params }) => this.api.list<Row>(params.api, { q: params.q, page: params.page, page_size: PAGE_SIZE }),
  });

  protected async remove(row: Row): Promise<void> {
    const label = String(row['name'] ?? row['title'] ?? row['question'] ?? `#${row.id}`);
    const ok = await this.confirmDialog.confirm('Delete item', `Delete "${label}"? This cannot be undone.`, { confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    this.api.remove(this.def().api, row.id).subscribe({
      next: () => {
        this.toast.show('Deleted');
        this.rows.reload();
      },
      error: (err: unknown) => this.toast.error(apiError(err)),
    });
  }
}
