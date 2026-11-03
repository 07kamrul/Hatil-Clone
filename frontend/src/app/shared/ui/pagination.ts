import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

const WINDOW = 2;

@Component({
  selector: 'app-pagination',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (pages() > 1) {
      <nav aria-label="Pagination" class="mt-8 flex flex-wrap items-center justify-center gap-1">
        <button type="button" class="btn-outline" [disabled]="page() <= 1" (click)="go(page() - 1)">Prev</button>
        @for (n of numbers(); track $index) {
          @if (n === 0) { <span class="px-1">…</span> }
          @else {
            <button type="button" (click)="go(n)" [attr.aria-current]="n === page() ? 'page' : null"
                    [class]="n === page() ? 'btn-primary' : 'btn-outline'">{{ n }}</button>
          }
        }
        <button type="button" class="btn-outline" [disabled]="page() >= pages()" (click)="go(page() + 1)">Next</button>
      </nav>
    }
  `,
})
export class Pagination {
  readonly page = input.required<number>();
  readonly pages = input.required<number>();
  readonly pageChange = output<number>();

  /** Page numbers with 0 as an ellipsis marker. */
  protected readonly numbers = computed(() => {
    const total = this.pages(), current = this.page();
    const out: number[] = [];
    for (let n = 1; n <= total; n++) {
      if (n === 1 || n === total || Math.abs(n - current) <= WINDOW) out.push(n);
      else if (out[out.length - 1] !== 0) out.push(0);
    }
    return out;
  });

  protected go(n: number): void {
    if (n >= 1 && n <= this.pages() && n !== this.page()) this.pageChange.emit(n);
  }
}
