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
    <main id="main" class="min-h-screen"><router-outlet /></main>
    <app-footer />
    @if (settings.settings().hotline; as hotline) {
      <a [href]="'tel:' + hotline" [attr.aria-label]="'Call ' + hotline"
         class="fixed bottom-5 left-5 z-40 flex items-center gap-2 rounded-full bg-black/60 py-2 pl-3 pr-4 text-sm text-white backdrop-blur hover:bg-black/80">
        <app-icon name="phone" [size]="20" /><span class="hidden sm:inline">{{ hotline }}</span>
      </a>
    }
    @if (settings.settings().whatsapp_number) {
      <a [href]="settings.whatsappLink()" target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp"
         class="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#0e7a3e] text-white shadow-lg hover:bg-[#0b6332]">
        <app-icon name="whatsapp" [size]="28" />
      </a>
    }
  `,
})
export class PublicLayout {
  protected readonly settings = inject(SettingsStore);
}
