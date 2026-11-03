import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { MoneyPipe } from '../../../shared/ui/money-pipe';
import { AdminApi } from '../core/admin-api';

interface InquiryRow { id: number; total: number; customer_name: string | null; status: string; created_at: string; items: { name: string; quantity: number }[] }
interface ContactRow { id: number; name: string; subject: string | null; is_read: boolean; created_at: string }
interface DashboardStats {
  products_total: number; products_published: number; categories_total: number; inquiries_total: number;
  inquiries_new: number; inquiries_last_30_days: number; contact_unread: number; showrooms_total: number; blog_posts_total: number;
  top_viewed: { id: number; name: string; slug: string; sku: string; view_count: number }[];
  recent_contacts: ContactRow[]; recent_inquiries: InquiryRow[];
}

@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink, DatePipe, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-5 text-2xl font-bold">Dashboard</h1>
    @if (stats.value(); as s) {
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <a routerLink="/admin/products" class="card p-4 hover:shadow"><p class="text-sm text-gray-500">Products</p><p class="text-2xl font-bold">{{ s.products_total }}</p><p class="text-xs text-gray-500">{{ s.products_published }} published</p></a>
        <a routerLink="/admin/inquiries" class="card p-4 hover:shadow"><p class="text-sm text-gray-500">Order inquiries</p><p class="text-2xl font-bold">{{ s.inquiries_total }}</p><p class="text-xs text-gray-500">{{ s.inquiries_new }} new · {{ s.inquiries_last_30_days }} in 30 days</p></a>
        <a routerLink="/admin/messages" class="card p-4 hover:shadow"><p class="text-sm text-gray-500">Unread messages</p><p class="text-2xl font-bold" [class.text-red-600]="s.contact_unread">{{ s.contact_unread }}</p></a>
        <a routerLink="/admin/categories" class="card p-4 hover:shadow"><p class="text-sm text-gray-500">Categories</p><p class="text-2xl font-bold">{{ s.categories_total }}</p><p class="text-xs text-gray-500">{{ s.showrooms_total }} showrooms · {{ s.blog_posts_total }} posts</p></a>
      </div>

      <div class="mt-6 grid gap-6 xl:grid-cols-3">
        <section class="card p-4 xl:col-span-1">
          <h2 class="mb-3 font-semibold">Top viewed products</h2>
          <ol class="space-y-2 text-sm">
            @for (p of s.top_viewed; track p.id; let i = $index) {
              <li class="flex justify-between gap-2"><a [routerLink]="['/admin/products', p.id]" class="truncate hover:text-brand">{{ i + 1 }}. {{ p.name }}</a><span class="text-gray-500">{{ p.view_count }}</span></li>
            } @empty { <li class="text-gray-500">No data yet.</li> }
          </ol>
        </section>
        <section class="card p-4">
          <h2 class="mb-3 font-semibold">Recent inquiries</h2>
          <ul class="space-y-2 text-sm">
            @for (i of s.recent_inquiries; track i.id) {
              <li class="flex justify-between gap-2"><a routerLink="/admin/inquiries" class="truncate hover:text-brand">{{ i.customer_name || 'Anonymous' }} · {{ i.items.length }} item(s)</a>
                <span class="whitespace-nowrap">{{ i.total | money }}</span></li>
            } @empty { <li class="text-gray-500">No inquiries yet.</li> }
          </ul>
        </section>
        <section class="card p-4">
          <h2 class="mb-3 font-semibold">Recent contact messages</h2>
          <ul class="space-y-2 text-sm">
            @for (m of s.recent_contacts; track m.id) {
              <li class="flex justify-between gap-2"><a routerLink="/admin/messages" class="truncate hover:text-brand" [class.font-semibold]="!m.is_read">{{ m.name }} — {{ m.subject || 'No subject' }}</a>
                <span class="whitespace-nowrap text-gray-500">{{ m.created_at | date: 'MMM d' }}</span></li>
            } @empty { <li class="text-gray-500">No messages yet.</li> }
          </ul>
        </section>
      </div>
    } @else if (stats.error()) { <p class="text-red-600">Could not load dashboard.</p> }
    @else { <p class="text-gray-500">Loading…</p> }
  `,
})
export class AdminDashboard {
  private readonly api = inject(AdminApi);
  protected readonly stats = rxResource({ stream: () => this.api.dashboard<DashboardStats>() });
}
