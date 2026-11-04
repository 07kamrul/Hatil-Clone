import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { Api } from '../../core/api';
import { Faq } from '../../core/models';
import { Seo } from '../../core/seo';
import { Breadcrumbs } from '../../shared/ui/breadcrumbs';

@Component({
  selector: 'app-faq-page',
  imports: [RouterLink, Breadcrumbs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-breadcrumbs [crumbs]="[{ label: 'FAQ' }]" />
    <div class="container-x max-w-3xl pb-12">
      <h1 class="heading-1 mb-2">Frequently asked questions</h1>
      <p class="text-muted mb-8">Ordering on WhatsApp, delivery, payment and warranty — answered.</p>
      @for (group of groups(); track group.name) {
        <section class="mb-8" [attr.aria-label]="group.name">
          <h2 class="mb-3 text-lg font-semibold text-brand">{{ group.name }}</h2>
          <div class="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200">
            @for (f of group.items; track f.id) {
              <details class="group bg-white">
                <summary class="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 font-medium hover:bg-gray-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
                  <span>{{ f.question }}</span>
                  <span aria-hidden="true" class="shrink-0 text-xl leading-none text-gray-400 transition-transform group-open:rotate-45">+</span>
                </summary>
                <div class="prose-content break-words px-4 pb-4 text-gray-700" [innerHTML]="f.answer_html"></div>
              </details>
            }
          </div>
        </section>
      } @empty {
        @if (faqs.isLoading()) {
          <div aria-busy="true" aria-label="Loading questions">
            @for (n of [1, 2, 3, 4]; track n) { <div class="skeleton mb-2 h-12 rounded-lg"></div> }
          </div>
        } @else {
          <div class="empty-state"><p class="font-medium">No questions yet</p>
            <p class="text-muted text-sm">Have a question? <a routerLink="/contact" class="text-brand underline">Contact us</a>.</p></div>
        }
      }
    </div>
  `,
})
export class FaqPage {
  private readonly seo = inject(Seo);
  private readonly api = inject(Api);
  protected readonly faqs = rxResource({ stream: () => this.api.faqs().pipe(catchError(() => of([] as Faq[]))) });
  protected readonly groups = computed(() => {
    const byGroup = new Map<string, Faq[]>();
    for (const f of this.faqs.value() ?? []) byGroup.set(f.group, [...(byGroup.get(f.group) ?? []), f]);
    return [...byGroup].map(([name, items]) => ({ name, items }));
  });

  constructor() {
    effect(() => {
      const faqs = this.faqs.value() ?? [];
      this.seo.set({
        title: 'FAQ', path: '/faq', description: 'Answers about ordering on WhatsApp, delivery, payment and warranty.',
        jsonLd: faqs.length ? {
          '@context': 'https://schema.org', '@type': 'FAQPage',
          mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer_html } })),
        } : null,
      });
    });
  }
}
