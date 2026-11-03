import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Api } from '../../core/api';
import { Seo } from '../../core/seo';
import { SettingsStore } from '../../core/settings-store';
import { Breadcrumbs } from '../../shared/ui/breadcrumbs';
import { Icon } from '../../shared/ui/icon';

const PHONE_PATTERN = /^[0-9+\-() ]{6,50}$/;

@Component({
  selector: 'app-contact-page',
  imports: [ReactiveFormsModule, Breadcrumbs, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-breadcrumbs [crumbs]="[{ label: 'Contact' }]" />
    <div class="container-x grid gap-10 pb-12 lg:grid-cols-2">
      <div>
        <h1 class="text-2xl font-bold sm:text-3xl">Contact us</h1>
        <p class="mt-2 text-gray-600">Questions about a product, delivery or an order? Send us a message or reach us directly.</p>
        <ul class="mt-6 space-y-3 text-gray-700">
          <li class="flex gap-2"><app-icon name="phone" /> {{ s().hotline }}</li>
          <li class="flex gap-2"><app-icon name="mail" /> <a [href]="'mailto:' + s().contact_email" class="hover:text-brand">{{ s().contact_email }}</a></li>
          <li class="flex gap-2"><app-icon name="pin" /> {{ s().address }}</li>
        </ul>
        <a [href]="settings.whatsappLink()" target="_blank" rel="noopener noreferrer" class="btn-whatsapp mt-6"><app-icon name="whatsapp" /> Chat on WhatsApp</a>
      </div>

      @if (sent()) {
        <div class="h-fit rounded-lg border border-green-200 bg-green-50 p-6 text-green-800" role="status">
          <h2 class="text-lg font-semibold">Thank you!</h2>
          <p class="mt-1">{{ sent() }}</p>
          <button type="button" class="btn-outline mt-4" (click)="sent.set(null)">Send another message</button>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" class="card space-y-4 p-6" novalidate>
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
          <div><label class="label" for="subject">Subject</label><input id="subject" class="input" formControlName="subject" /></div>
          <div>
            <label class="label" for="message">Message *</label>
            <textarea id="message" rows="5" class="input" formControlName="message" [attr.aria-invalid]="invalid('message')"></textarea>
            @if (invalid('message')) { <p class="mt-1 text-xs text-red-600">Please write a message (at least 5 characters).</p> }
          </div>
          <!-- Honeypot: hidden from people, filled by bots -->
          <div class="hidden" aria-hidden="true"><label>Website <input tabindex="-1" autocomplete="off" formControlName="website" /></label></div>
          @if (error()) { <p class="rounded bg-red-50 p-2 text-sm text-red-700" role="alert">{{ error() }}</p> }
          <button type="submit" class="btn-primary w-full" [disabled]="sending()">{{ sending() ? 'Sending…' : 'Send message' }}</button>
        </form>
      }
    </div>
  `,
})
export class ContactPage {
  private readonly api = inject(Api);
  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly settings = inject(SettingsStore);
  protected readonly s = this.settings.settings;

  protected readonly sending = signal(false);
  protected readonly sent = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly needsContact = signal(false);

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    email: ['', [Validators.email, Validators.maxLength(255)]],
    phone: ['', [Validators.pattern(PHONE_PATTERN)]],
    subject: ['', [Validators.maxLength(255)]],
    message: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(5000)]],
    website: [''],
  });

  constructor() {
    inject(Seo).set({ title: 'Contact us', description: 'Get in touch by phone, WhatsApp, email or the contact form.', path: '/contact' });
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
}
