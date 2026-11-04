import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { Api } from '../../core/api';
import { SettingsStore } from '../../core/settings-store';
import { Icon } from '../ui/icon';

interface FooterLink {
  readonly label: string;
  readonly path: string;
}
interface FooterPage {
  title: string;
  slug: string;
}

const NEED_HELP: readonly FooterLink[] = [
  { label: 'Contact Us', path: '/contact' },
  { label: 'FAQ', path: '/faq' },
  { label: 'Showroom Locator', path: '/showrooms' },
  { label: 'Your Cart', path: '/cart' },
];

const MORE_INFO: readonly FooterLink[] = [
  { label: 'All Products', path: '/products' },
  { label: 'Inspiration', path: '/blog' },
  { label: 'Compare', path: '/compare' },
  { label: 'Wishlist', path: '/wishlist' },
];

/** Dark, four-column footer in the hatil.com structure: brand · The Company · Need Help? · More Information. */
@Component({
  selector: 'app-footer',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="mt-16 bg-[#141414] text-neutral-400 sm:mt-20">
      <div class="h-0.5 bg-gradient-to-r from-transparent via-brand to-transparent"></div>
      <div
        class="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:gap-10 lg:px-8"
      >
        <div>
          <a routerLink="/" class="text-2xl font-semibold tracking-tight text-white">{{
            s().site_name
          }}</a>
          @if (s().footer_text) {
            <p class="mt-3 max-w-xs text-sm leading-relaxed">{{ s().footer_text }}</p>
          }
          <ul class="mt-6 space-y-3 text-sm">
            @if (s().address) {
              <li class="flex gap-3">
                <app-icon name="pin" [size]="18" class="mt-0.5 shrink-0 text-brand" />{{
                  s().address
                }}
              </li>
            }
            @if (s().hotline) {
              <li>
                <a [href]="'tel:' + s().hotline" class="flex gap-3 hover:text-white"
                  ><app-icon name="phone" [size]="18" class="shrink-0 text-brand" />{{
                    s().hotline
                  }}</a
                >
              </li>
            }
            @if (s().whatsapp_number) {
              <li>
                <a
                  [href]="settings.whatsappLink()"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex gap-3 hover:text-white"
                >
                  <app-icon name="whatsapp" [size]="18" class="shrink-0 text-brand" />{{
                    s().whatsapp_number
                  }}</a
                >
              </li>
            }
            @if (s().contact_email) {
              <li>
                <a [href]="'mailto:' + s().contact_email" class="flex gap-3 hover:text-white"
                  ><app-icon name="mail" [size]="18" class="shrink-0 text-brand" />{{
                    s().contact_email
                  }}</a
                >
              </li>
            }
          </ul>
          @if (socials().length) {
            <div class="mt-6 flex gap-2">
              @for (so of socials(); track so.icon) {
                <a
                  [href]="so.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  [attr.aria-label]="so.label"
                  class="flex h-11 w-11 items-center justify-center rounded-full border border-neutral-700 transition hover:border-brand hover:bg-brand hover:text-white"
                >
                  <app-icon [name]="so.icon" [size]="16"
                /></a>
              }
            </div>
          }
        </div>

        <nav aria-label="The company" class="border-t border-neutral-800 pt-2 lg:border-0 lg:pt-0">
          <details class="group" [open]="isDesktop()">
          <summary class="footer-title">The Company<app-icon name="chevronDown" [size]="18" class="transition-transform group-open:rotate-180 lg:hidden" /></summary>
          <ul class="space-y-1 pb-3 text-sm lg:space-y-3">
            <li><a routerLink="/" class="footer-link">Return Home</a></li>
            @for (p of pages(); track p.slug) {
              <li>
                <a [routerLink]="['/page', p.slug]" class="footer-link">{{ p.title }}</a>
              </li>
            }
          </ul>
          </details>
        </nav>
        <nav aria-label="Need help" class="border-t border-neutral-800 pt-2 lg:border-0 lg:pt-0">
          <details class="group" [open]="isDesktop()">
          <summary class="footer-title">Need Help?<app-icon name="chevronDown" [size]="18" class="transition-transform group-open:rotate-180 lg:hidden" /></summary>
          <ul class="space-y-1 pb-3 text-sm lg:space-y-3">
            @for (l of needHelp; track l.path) {
              <li>
                <a [routerLink]="l.path" class="footer-link">{{ l.label }}</a>
              </li>
            }
          </ul>
          </details>
        </nav>
        <nav aria-label="More information" class="border-t border-neutral-800 pt-2 lg:border-0 lg:pt-0">
          <details class="group" [open]="isDesktop()">
          <summary class="footer-title">More Information<app-icon name="chevronDown" [size]="18" class="transition-transform group-open:rotate-180 lg:hidden" /></summary>
          <ul class="space-y-1 pb-3 text-sm lg:space-y-3">
            @for (l of moreInfo; track l.path) {
              <li>
                <a [routerLink]="l.path" class="footer-link">{{ l.label }}</a>
              </li>
            }
          </ul>
          </details>
          @if (s().whatsapp_number) {
            <a
              [href]="settings.whatsappLink()"
              target="_blank"
              rel="noopener noreferrer"
              class="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-brand px-5 py-2 text-sm font-medium text-white transition hover:bg-brand"
            >
              <app-icon name="whatsapp" [size]="16" /> Order on WhatsApp</a
            >
          }
        </nav>
      </div>
      <div class="border-t border-neutral-800">
        <p class="mx-auto max-w-7xl px-6 py-5 text-center text-xs tracking-wide text-neutral-500">
          © Copyright {{ year }} {{ s().site_name }}. All Rights Reserved
        </p>
      </div>
    </footer>
  `,
  styles: `
    .footer-title {
      display: flex;
      min-height: 2.75rem;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      list-style: none;
      font-size: 0.8rem;
      font-weight: 600;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #fff;
    }
    .footer-title::-webkit-details-marker {
      display: none;
    }
    @media (min-width: 64rem) {
      .footer-title {
        min-height: 0;
        margin-bottom: 1.25rem;
        cursor: default;
        pointer-events: none;
      }
    }
    .footer-link {
      position: relative;
      display: inline-flex;
      min-height: 2.75rem;
      align-items: center;
      transition:
        color 0.15s,
        padding 0.15s;
    }
    @media (min-width: 64rem) {
      .footer-link {
        min-height: 0;
      }
    }
    .footer-link:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 2px;
      color: #fff;
    }
    .footer-link:hover {
      color: #fff;
      padding-left: 0.35rem;
    }
  `,
})
export class Footer {
  protected readonly settings = inject(SettingsStore);
  protected readonly s = this.settings.settings;
  protected readonly year = new Date().getFullYear();
  /** Columns render collapsed (mobile accordion) until the browser confirms a desktop viewport. */
  protected readonly isDesktop = signal(false);

  constructor() {
    afterNextRender(() => {
      const mq = window.matchMedia('(min-width: 64rem)');
      this.isDesktop.set(mq.matches);
      mq.addEventListener('change', (e) => this.isDesktop.set(e.matches));
    });
  }
  protected readonly needHelp = NEED_HELP;
  protected readonly moreInfo = MORE_INFO;
  protected readonly pages = toSignal(
    inject(Api)
      .footerPages()
      .pipe(catchError(() => of([] as FooterPage[]))),
    { initialValue: [] as FooterPage[] },
  );
  protected readonly socials = computed(() => {
    const s = this.s();
    return [
      { icon: 'facebook', label: 'Facebook', url: s.social_facebook },
      { icon: 'instagram', label: 'Instagram', url: s.social_instagram },
      { icon: 'youtube', label: 'YouTube', url: s.social_youtube },
      { icon: 'linkedin', label: 'LinkedIn', url: s.social_linkedin },
    ].filter((so) => !!so.url);
  });
}
