import { InjectionToken, inject } from '@angular/core';

/** Base URL of the REST API. Relative in the browser (nginx/dev proxy), absolute on the SSR server. */
export const API_BASE = new InjectionToken<string>('API_BASE', {
  providedIn: 'root',
  factory: () => '/api/v1',
});

/** Public origin used for canonical URLs and OpenGraph tags. */
export const SITE_ORIGIN = new InjectionToken<string>('SITE_ORIGIN', {
  providedIn: 'root',
  factory: () => '',
});

export function injectApiBase(): string {
  return inject(API_BASE);
}
