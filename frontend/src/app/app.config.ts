import { DOCUMENT } from '@angular/common';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import {
  provideRouter, withComponentInputBinding, withInMemoryScrolling, withViewTransitions,
} from '@angular/router';

import { routes } from './app.routes';
import { SITE_ORIGIN } from './core/config';
import { SettingsStore } from './core/settings-store';
import { authInterceptor } from './features/admin/core/auth-interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
      withViewTransitions(),
    ),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideClientHydration(withEventReplay()),
    { provide: SITE_ORIGIN, useFactory: () => inject(DOCUMENT).location?.origin ?? '' },
    provideAppInitializer(() => inject(SettingsStore).load()),
  ],
};
