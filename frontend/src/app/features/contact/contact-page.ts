import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Api } from '../../core/api';
import { Seo } from '../../core/seo';
import { SettingsStore } from '../../core/settings-store';
import { Breadcrumbs } from '../../shared/ui/breadcrumbs';
import { Icon } from '../../shared/ui/icon';

const PHONE_PATTERN = /^[0-9+\-() ]{6,50}$/;

/** Fixed reply-time copy shown in the hero band. */
const REPLY_NOTE = 'Our team typically replies within one working day.';

@Component({
  selector: 'app-contact-page',
  imports: [ReactiveFormsModule, Breadcrumbs, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-breadcrumbs [crumbs]="[{ label: 'Contact' }]" />

    <div class="container-x pt-8">
      <h1 class="text-2xl font-bold sm:text-3xl">Contact us</h1>
      <p class="mt-2 max-w-2xl text-gray-600">Questions about a product, delivery or an order? Reach us on the channel that suits you — or send a message below.</p>
      <p class="mt-2 flex items-center gap-2 text-sm text-gray-500"><app-icon name="clock" [size]="16" /> {{ replyNote }}</p>
      <hr class="mt-6 border-gray-200" />
    </div>

    <div class="container-x py-10">
      <!-- Quick actions -->
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <a [href]="callHref()" class="card group flex flex-col gap-2 p-5 transition hover:-translate-y-0.5 hover:shadow-md">
          <span class="grid h-10 w-10 place-items-center rounded-full bg-brand/10 text-brand"><app-icon name="phone" /></span>
          <span class="font-semibold">Call us</span>
          <span class="text-sm text-gray-600 break-all">{{ s().hotline || 'Not set yet' }}</span>
        </a>
        <a [href]="settings.whatsappLink()" target="_blank" rel="noopener noreferrer" class="card group flex flex-col gap-2 p-5 transition hover:-translate-y-0.5 hover:shadow-md">
          <span class="grid h-10 w-10 place-items-center rounded-full bg-green-100 text-green-700"><app-icon name="whatsapp" /></span>
          <span class="font-semibold">WhatsApp</span>
          <span class="text-sm text-gray-600">Chat with our sales team</span>
        </a>
        <a [href]="'mailto:' + s().contact_email" class="card group flex flex-col gap-2 p-5 transition hover:-translate-y-0.5 hover:shadow-md">
          <span class="grid h-10 w-10 place-items-center rounded-full bg-brand/10 text-brand"><app-icon name="mail" /></span>
          <span class="font-semibold">Email</span>
          <span class="text-sm text-gray-600 break-all">{{ s().contact_email || 'Not set yet' }}</span>
        </a>
        <div class="card flex flex-col gap-2 p-5">
          <span class="grid h-10 w-10 place-items-center rounded-full bg-brand/10 text-brand"><app-icon name="pin" /></span>
          <span class="font-semibold">Visit us</span>
          <span class="text-sm text-gray-600">{{ s().address }}</span>
          <a [href]="settings.mapDirectionsUrl()" target="_blank" rel="noopener noreferrer" class="mt-auto text-sm font-medium text-brand hover:underline">Get directions →</a>
        </div>
      </div>

      <!-- Form + map -->
      <div class="mt-10 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 class="text-xl font-bold">Send us a message</h2>
          @if (sent()) {
            <div class="card mt-4 space-y-3 border-green-200 bg-green-50 text-green-800" role="status">
              <p class="flex items-center gap-2 font-semibold"><app-icon name="check" /> Thank you!</p>
              <p>{{ sent() }}</p>
              <button type="button" class="btn-outline" (click)="sent.set(null)">Send another message</button>
            </div>
          } @else {
            <form [formGroup]="form" (ngSubmit)="submit()" class="card mt-4 space-y-4 p-6" novalidate>
              <div>
                <label class="label" for="name">Name *</label>
                <input id="name" class="input" formControlName="name" autocomplete="name" [attr.aria-invalid]="invalid('name')" />
                @if (invalid('name')) { <p class="mt-1 text-xs text-red-600">Please enter your name (at least 2 characters).</p> }
              </div>
              <div class="grid gap-4 sm:grid-cols-2">
                <div>
                  <label class="label" for="email">Email</label>
                  <input id="email" type="email" class="input" formControlName="email" autocomplete="email" [attr.aria-invalid]="invalid('email')" />
                  @if (invalid('email')) { <p class="mt-1 text-xs text-red-600">Enter a valid email.</p> }
                </div>
                <div>
                  <label class="label" for="phone">Phone</label>
                  <input id="phone" type="tel" class="input" formControlName="phone" autocomplete="tel" [attr.aria-invalid]="invalid('phone')" />
                  @if (invalid('phone')) { <p class="mt-1 text-xs text-red-600">Enter a valid phone number.</p> }
                </div>
              </div>
              @if (needsContact()) { <p class="text-xs text-red-600">Please give an email or a phone number so we can reply.</p> }
              <div>
                <label class="label" for="subject">Subject</label>
                <select id="subject" class="input" formControlName="subject">
                  <option value="">Choose a topic…</option>
                  @for (topic of topics; track topic) { <option [value]="topic">{{ topic }}</option> }
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label class="label" for="message">Message *</label>
                <textarea id="message" rows="5" class="input" formControlName="message" maxlength="5000"
                          (input)="messageLength.set(form.controls.message.value.length)"
                          [attr.aria-invalid]="invalid('message')"></textarea>
                <div class="mt-1 flex justify-between gap-2 text-xs">
                  @if (invalid('message')) { <p class="text-red-600">Please write a message (at least 5 characters).</p> }
                  <p class="ml-auto text-gray-400">{{ messageLength() }} / 5000</p>
                </div>
              </div>
              <!-- Honeypot: hidden from people, filled by bots -->
              <div class="hidden" aria-hidden="true"><label>Website <input tabindex="-1" autocomplete="off" formControlName="website" /></label></div>
              @if (error()) { <p class="rounded bg-red-50 p-2 text-sm text-red-700" role="alert">{{ error() }}</p> }
              <button type="submit" class="btn-primary w-full" [disabled]="sending()">{{ sending() ? 'Sending…' : 'Send message' }}</button>
            </form>
          }
        </div>

        <div>
          <h2 class="text-xl font-bold">Find us</h2>
          <iframe class="mt-4 w-full rounded-lg border border-gray-200 bg-gray-100"
                  height="420" [src]="settings.mapEmbedUrlSafe()" loading="lazy"
                  [title]="'Map to ' + s().site_name" referrerpolicy="no-referrer-when-downgrade"
                  allowfullscreen></iframe>
          <p class="mt-3 flex items-start gap-2 text-sm text-gray-600"><app-icon name="pin" [size]="16" /> {{ s().address }}</p>
          <a [href]="settings.mapDirectionsUrl()" target="_blank" rel="noopener noreferrer" class="btn-outline mt-3">
            <app-icon name="pin" [size]="16" /> Open in Google Maps
          </a>
        </div>
      </div>
    </div>
  `,
})
export class ContactPage {
  private readonly api = inject(Api);
  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly settings = inject(SettingsStore);
  protected readonly s = this.settings.settings;
  protected readonly replyNote = REPLY_NOTE;
  protected readonly topics = ['Product question', 'Order status', 'Delivery', 'Warranty', 'Careers'];

  protected readonly sending = signal(false);
  protected readonly sent = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly needsContact = signal(false);
  protected readonly messageLength = signal(0);

  protected readonly callHref = computed(() => `tel:${this.s().hotline.replace(/[^+\d]/g, '')}`);

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    email: ['', [Validators.email, Validators.maxLength(255)]],
    phone: ['', [Validators.pattern(PHONE_PATTERN)]],
    subject: ['', [Validators.maxLength(255)]],
    message: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(5000)]],
    website: [''],
  });

  constructor() {
    inject(Seo).set({
      title: 'Contact us',
      description: 'Get in touch by phone, WhatsApp, email or the contact form.',
      path: '/contact',
      jsonLd: this.localBusinessJsonLd(),
    });
  }

  protected invalid(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    this.needsContact.set(!v.email.trim() && !v.phone.trim());
    if (this.form.invalid || this.needsContact()) return;
    this.sending.set(true);
    this.error.set(null);
    this.api.sendContact({
      name: v.name.trim(), message: v.message.trim(), subject: v.subject.trim() || undefined,
      email: v.email.trim() || undefined, phone: v.phone.trim() || undefined, website: v.website || undefined,
    }).subscribe({
      next: (res) => {
        this.sending.set(false);
        this.sent.set(res.detail);
        this.form.reset();
      },
      error: (err: HttpErrorResponse) => {
        this.sending.set(false);
        this.error.set(err.status === 429 ? 'Too many messages — please try again in a minute.' : 'Sorry, your message could not be sent. Please try again or call us.');
      },
    });
  }

  private localBusinessJsonLd(): object {
    const s = this.s();
    return {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: s.site_name,
      telephone: s.hotline || undefined,
      email: s.contact_email || undefined,
      address: { '@type': 'PostalAddress', streetAddress: s.address },
      geo: { '@type': 'GeoCoordinates', latitude: this.settings.mapPoint().lat, longitude: this.settings.mapPoint().lng },
    };
  }
}
