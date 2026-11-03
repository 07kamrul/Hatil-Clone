import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { Api } from '../../core/api';
import { SettingsStore } from '../../core/settings-store';
import { Icon } from '../ui/icon';

@Component({
  selector: 'app-footer',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="mt-16 bg-gray-900 text-gray-300">
      <div class="container-x grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <h3 class="mb-3 text-lg font-semibold text-white">{{ s().site_name }}</h3>
          <p class="text-sm">{{ s().footer_text }}</p>
          <div class="mt-4 flex gap-3 text-sm">
            @if (s().social_facebook) { <a [href]="s().social_facebook" rel="noopener noreferrer" target="_blank" class="hover:text-white">Facebook</a> }
            @if (s().social_instagram) { <a [href]="s().social_instagram" rel="noopener noreferrer" target="_blank" class="hover:text-white">Instagram</a> }
            @if (s().social_youtube) { <a [href]="s().social_youtube" rel="noopener noreferrer" target="_blank" class="hover:text-white">YouTube</a> }
            @if (s().social_linkedin) { <a [href]="s().social_linkedin" rel="noopener noreferrer" target="_blank" class="hover:text-white">LinkedIn</a> }
          </div>
        </div>
        <div>
          <h3 class="mb-3 font-semibold text-white">Company</h3>
          <ul class="space-y-2 text-sm">
            @for (p of pages(); track p.slug) { <li><a [routerLink]="['/page', p.slug]" class="hover:text-white">{{ p.title }}</a></li> }
          </ul>
        </div>
        <div>
          <h3 class="mb-3 font-semibold text-white">Help</h3>
          <ul class="space-y-2 text-sm">
            <li><a routerLink="/contact" class="hover:text-white">Contact us</a></li>
            <li><a routerLink="/faq" class="hover:text-white">FAQ</a></li>
            <li><a routerLink="/showrooms" class="hover:text-white">Showrooms</a></li>
            <li><a routerLink="/blog" class="hover:text-white">Inspiration</a></li>
          </ul>
        </div>
        <div>
          <h3 class="mb-3 font-semibold text-white">Get in touch</h3>
          <ul class="space-y-2 text-sm">
            <li class="flex gap-2"><app-icon name="phone" [size]="16" /> {{ s().hotline }}</li>
            <li class="flex gap-2"><app-icon name="mail" [size]="16" /> {{ s().contact_email }}</li>
            <li class="flex gap-2"><app-icon name="pin" [size]="16" /> {{ s().address }}</li>
          </ul>
          <a [href]="settings.whatsappLink()" target="_blank" rel="noopener noreferrer" class="btn-whatsapp mt-4">
            <app-icon name="whatsapp" [size]="18" /> Chat on WhatsApp
          </a>
        </div>
      </div>
      <div class="border-t border-gray-800 py-4 text-center text-xs">© {{ year }} {{ s().site_name }}. All rights reserved.</div>
    </footer>
  `,
})
export class Footer {
  protected readonly settings = inject(SettingsStore);
  protected readonly s = this.settings.settings;
  protected readonly year = new Date().getFullYear();
  protected readonly pages = toSignal(
    inject(Api).footerPages().pipe(catchError(() => of([] as { title: string; slug: string }[]))),
    { initialValue: [] as { title: string; slug: string }[] },
  );
}
