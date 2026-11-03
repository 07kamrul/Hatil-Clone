import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';

import { Toast } from '../../../core/toast';
import { MoneyPipe } from '../../../shared/ui/money-pipe';
import { AdminApi, apiError } from '../core/admin-api';

const PAGE_SIZE = 20;

interface InquiryItem { name: string; sku: string | null; slug: string | null; variant: string | null; quantity: number; unit_price: number }
interface Inquiry { id: number; items: InquiryItem[]; total: number; customer_name: string | null; phone: string | null; address: string | null; note: string | null; source: string; status: string; created_at: string }
interface ContactMessage { id: number; name: string; email: string | null; phone: string | null; subject: string | null; message: string; is_read: boolean; created_at: string }

@Component({
  selector: 'app-admin-inquiries',
  imports: [DatePipe, FormsModule, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-2 text-2xl font-bold">Order inquiries</h1>
    <p class="mb-4 text-sm text-gray-600">Anonymous log of WhatsApp checkouts for analytics. Orders themselves are handled in WhatsApp.</p>
    <div class="mb-3 flex flex-wrap gap-2">
      <select class="input !w-auto" [ngModel]="status()" (ngModelChange)="status.set($event); page.set(1)" aria-label="Status">
        <option value="">All statuses</option><option value="new">New</option><option value="contacted">Contacted</option><option value="closed">Closed</option>
      </select>
      <input type="search" class="input max-w-xs" placeholder="Search name, phone, address…" [ngModel]="q()" (ngModelChange)="q.set($event); page.set(1)" aria-label="Search" />
    </div>
    <div class="space-y-3">
      @for (i of rows.value()?.items; track i.id) {
        <article class="card p-4 text-sm">
          <div class="flex flex-wrap items-center gap-3">
            <strong>#{{ i.id }}</strong>
            <span class="text-gray-500">{{ i.created_at | date: 'medium' }}</span>
            <span class="rounded bg-gray-100 px-2 text-xs">{{ i.source }}</span>
            <span class="ml-auto font-semibold">{{ i.total | money }}</span>
            <select class="input !w-auto !py-1" [ngModel]="i.status" (ngModelChange)="setStatus(i.id, $event)" [attr.aria-label]="'Status of inquiry ' + i.id">
              <option value="new">New</option><option value="contacted">Contacted</option><option value="closed">Closed</option>
            </select>
            <button type="button" class="text-red-600 hover:underline" (click)="remove(i.id)">Delete</button>
          </div>
          @if (i.customer_name || i.phone || i.address) {
            <p class="mt-2 text-gray-700">{{ i.customer_name || '—' }} · {{ i.phone || 'no phone' }} · {{ i.address || 'no address' }}</p>
          }
          @if (i.note) { <p class="mt-1 italic text-gray-600">“{{ i.note }}”</p> }
          <ul class="mt-2 divide-y rounded border">
            @for (it of i.items; track $index) {
              <li class="flex justify-between gap-2 px-3 py-1.5">
                <span>@if (it.slug) { <a [href]="'/product/' + it.slug" target="_blank" class="hover:text-brand">{{ it.name }}</a> } @else { {{ it.name }} }
                  <span class="text-gray-500">{{ it.sku }}@if (it.variant) { · {{ it.variant }} }</span></span>
                <span class="whitespace-nowrap">{{ it.quantity }} × {{ it.unit_price | money }}</span>
              </li>
            }
          </ul>
        </article>
      } @empty { <p class="text-gray-500">{{ rows.isLoading() ? 'Loading…' : 'No inquiries.' }}</p> }
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
export class AdminInquiries {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(Toast);
  protected readonly status = signal('');
  protected readonly q = signal('');
  protected readonly page = signal(1);
  protected readonly rows = rxResource({
    params: () => ({ status: this.status(), q: this.q(), page: this.page(), page_size: PAGE_SIZE }),
    stream: ({ params }) => this.api.list<Inquiry>('inquiries', params),
  });

  protected setStatus(id: number, status: string): void {
    this.api.update('inquiries', id, { status }).subscribe({ next: () => this.toast.show('Status updated'), error: (e: unknown) => this.toast.error(apiError(e)) });
  }

  protected remove(id: number): void {
    if (!confirm('Delete this inquiry?')) return;
    this.api.remove('inquiries', id).subscribe({ next: () => this.rows.reload(), error: (e: unknown) => this.toast.error(apiError(e)) });
  }
}

@Component({
  selector: 'app-admin-messages',
  imports: [DatePipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-4 text-2xl font-bold">Contact messages</h1>
    <div class="mb-3 flex flex-wrap gap-2">
      <select class="input !w-auto" [ngModel]="filter()" (ngModelChange)="filter.set($event); page.set(1)" aria-label="Filter">
        <option value="">All</option><option value="false">Unread</option><option value="true">Read</option>
      </select>
      <input type="search" class="input max-w-xs" placeholder="Search…" [ngModel]="q()" (ngModelChange)="q.set($event); page.set(1)" aria-label="Search" />
    </div>
    <div class="space-y-3">
      @for (m of rows.value()?.items; track m.id) {
        <article class="card p-4 text-sm" [class.border-brand]="!m.is_read">
          <div class="flex flex-wrap items-center gap-3">
            <strong [class.text-brand]="!m.is_read">{{ m.name }}</strong>
            @if (m.email) { <a [href]="'mailto:' + m.email" class="text-gray-600 hover:underline">{{ m.email }}</a> }
            @if (m.phone) { <a [href]="'tel:' + m.phone" class="text-gray-600 hover:underline">{{ m.phone }}</a> }
            <span class="ml-auto text-gray-500">{{ m.created_at | date: 'medium' }}</span>
          </div>
          @if (m.subject) { <p class="mt-2 font-medium">{{ m.subject }}</p> }
          <p class="mt-1 whitespace-pre-line text-gray-700">{{ m.message }}</p>
          <div class="mt-3 flex gap-4">
            <button type="button" class="text-brand hover:underline" (click)="mark(m)">Mark as {{ m.is_read ? 'unread' : 'read' }}</button>
            <button type="button" class="text-red-600 hover:underline" (click)="remove(m.id)">Delete</button>
          </div>
        </article>
      } @empty { <p class="text-gray-500">{{ rows.isLoading() ? 'Loading…' : 'No messages.' }}</p> }
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
export class AdminMessages {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(Toast);
  protected readonly filter = signal('');
  protected readonly q = signal('');
  protected readonly page = signal(1);
  protected readonly rows = rxResource({
    params: () => ({ is_read: this.filter(), q: this.q(), page: this.page(), page_size: PAGE_SIZE }),
    stream: ({ params }) => this.api.list<ContactMessage>('contact-messages', params),
  });

  protected mark(m: ContactMessage): void {
    this.api.update('contact-messages', m.id, { is_read: !m.is_read }).subscribe({ next: () => this.rows.reload(), error: (e: unknown) => this.toast.error(apiError(e)) });
  }

  protected remove(id: number): void {
    if (!confirm('Delete this message?')) return;
    this.api.remove('contact-messages', id).subscribe({ next: () => this.rows.reload(), error: (e: unknown) => this.toast.error(apiError(e)) });
  }
}
