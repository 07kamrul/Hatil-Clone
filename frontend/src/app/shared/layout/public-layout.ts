import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { SettingsStore } from '../../core/settings-store';
import { Icon } from '../ui/icon';
import { Footer } from './footer';
import { Header } from './header';

@Component({
  selector: 'app-public-layout',
  imports: [RouterOutlet, Header, Footer, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[200] focus:rounded focus:bg-white focus:p-2">Skip to content</a>
    <app-header />
    <main id="main" class="min-h-screen overflow-x-clip"><router-outlet /></main>
    <app-footer />
    @if (settings.settings().hotline; as hotline) {
      <a [href]="'tel:' + hotline" [attr.aria-label]="'Call ' + hotline"
         class="float-btn fixed bottom-5 left-4 z-40 flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full bg-black/60 px-3 sm:left-5 sm:pr-4 text-sm text-white backdrop-blur hover:bg-black/80">
        <app-icon name="phone" [size]="20" /><span class="hidden sm:inline">{{ hotline }}</span>
      </a>
    }
    @if (settings.settings().whatsapp_number) {
      <a [href]="settings.whatsappLink()" target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp"
         class="float-btn fixed bottom-5 right-4 z-40 flex h-14 w-14 sm:right-5 items-center justify-center rounded-full bg-[#0e7a3e] text-white shadow-lg hover:bg-[#0b6332]">
        <app-icon name="whatsapp" [size]="28" />
      </a>
    }
  `,
  styles: `
    .float-btn {
      transition: bottom 0.2s;
    }
    .float-btn:focus-visible {
      outline: 2px solid var(--color-brand);
      outline-offset: 2px;
    }
    /* Lift floating buttons above a page's mobile sticky action bar. */
    @media (max-width: 63.999rem) {
      :host:has(.sticky-bar) .float-btn {
        bottom: calc(5.5rem + env(safe-area-inset-bottom));
      }
    }
  `,
})
export class PublicLayout {
  protected readonly settings = inject(SettingsStore);
}
