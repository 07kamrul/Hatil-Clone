import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';

import { Api } from '../../core/api';
import { Faq } from '../../core/models';
import { Seo } from '../../core/seo';
import { Breadcrumbs } from '../../shared/ui/breadcrumbs';

@Component({
  selector: 'app-faq-page',
  imports: [Breadcrumbs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-breadcrumbs [crumbs]="[{ label: 'FAQ' }]" />
    <div class="container-x max-w-3xl pb-12">
      <h1 class="mb-6 text-3xl font-bold">Frequently asked questions</h1>
      @for (group of groups(); track group.name) {
        <section class="mb-8">
          <h2 class="mb-3 text-lg font-semibold text-brand">{{ group.name }}</h2>
          @for (f of group.items; track f.id) {
            <details class="mb-2 rounded-md border p-4">
              <summary class="cursor-pointer font-medium">{{ f.question }}</summary>
              <div class="prose-content mt-2 text-gray-700" [innerHTML]="f.answer_html"></div>
            </details>
          }
        </section>
      } @empty {
        @if (!faqs.isLoading()) { <p class="text-gray-500">No questions yet.</p> }
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
