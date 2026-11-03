import { DOCUMENT } from '@angular/common';
import { InjectionToken, inject } from '@angular/core';

/** Name of the <meta> tag server.ts injects with the runtime API base (API_BASE_URL env var). */
export const API_BASE_META = 'api-base';
const DEFAULT_API_BASE = '/api/v1';

/**
 * Base URL of the REST API. In the browser it is read from the runtime <meta name="api-base"> tag
 * (absolute when the API has its own domain), falling back to the relative nginx/dev-proxy path.
 * The SSR server overrides this token with the internal URL.
 */
export const API_BASE = new InjectionToken<string>('API_BASE', {
  providedIn: 'root',
  factory: () => {
    const meta = inject(DOCUMENT).querySelector<HTMLMetaElement>(`meta[name="${API_BASE_META}"]`);
    return meta?.content?.replace(/\/$/, '') || DEFAULT_API_BASE;
  },
});

/** Public origin used for canonical URLs and OpenGraph tags. */
export const SITE_ORIGIN = new InjectionToken<string>('SITE_ORIGIN', {
  providedIn: 'root',
  factory: () => '',
});

export function injectApiBase(): string {
  return inject(API_BASE);
}
