import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Admin is behind a login and needs localStorage tokens: render on the client only.
  { path: 'admin', renderMode: RenderMode.Client },
  { path: 'admin/**', renderMode: RenderMode.Client },
  // Catalog data changes at any time, so public pages are rendered per request (fresh SEO tags + JSON-LD).
  { path: '**', renderMode: RenderMode.Server },
];
