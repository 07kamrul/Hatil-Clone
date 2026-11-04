import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

import { API_BASE_META } from './app/core/config';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

// Runtime API base the browser should call (e.g. https://api.example.com/api/v1). Unset = same-origin /api/v1.
// An invalid value is logged and ignored (same-origin fallback) so the server still starts instead of 502ing.
function readBrowserApiBase(raw: string): string {
  const value = raw.trim().replace(/\/$/, '');
  if (!value) return '';
  try {
    new URL(value);
    return value;
  } catch {
    console.error(`[server] ignoring invalid API_BASE_URL "${value}"; expected an absolute URL`);
    return '';
  }
}

const BROWSER_API_BASE = readBrowserApiBase(process.env['API_BASE_URL'] ?? '');
const API_ORIGIN = BROWSER_API_BASE ? new URL(BROWSER_API_BASE).origin : '';
const withApiOrigin = (directive: string): string =>
  API_ORIGIN ? `${directive} ${API_ORIGIN}` : directive;

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  withApiOrigin("img-src 'self' data: blob: https://*.tile.openstreetmap.org"),
  "frame-src https://www.google.com https://maps.google.com",
  withApiOrigin("connect-src 'self'"),
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self' https://wa.me https://api.whatsapp.com",
  "object-src 'none'",
].join('; ');

const escapeAttr = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const API_BASE_META_TAG = BROWSER_API_BASE
  ? `<meta name="${API_BASE_META}" content="${escapeAttr(BROWSER_API_BASE)}">`
  : '';

const ADMIN_PATH = /^\/admin(\/|$)/;

app.disable('x-powered-by');

/**
 * Security headers on every response; admin pages are never cached.
 */
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  if (ADMIN_PATH.test(req.path)) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

/**
 * Uploaded images are stored as relative /uploads/... URLs; when the API has its own domain, send them there.
 */
if (API_ORIGIN) {
  app.get(/^\/uploads\//, (req, res) => res.redirect(301, `${API_ORIGIN}${req.originalUrl}`));
}

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? sendWithRuntimeConfig(response, res) : next()))
    .catch(next);
});

/** Adds the runtime API base <meta> to HTML pages (SSR and client-only admin shell alike). */
async function sendWithRuntimeConfig(response: Response, res: express.Response): Promise<void> {
  const isHtml = response.headers.get('content-type')?.includes('text/html') ?? false;
  if (!API_BASE_META_TAG || !isHtml) {
    await writeResponseToNodeResponse(response, res);
    return;
  }
  const html = (await response.text()).replace('</head>', `${API_BASE_META_TAG}</head>`);
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  await writeResponseToNodeResponse(new Response(html, { status: response.status, headers }), res);
}

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(
      `Node Express server listening on port ${port} (API base: ${BROWSER_API_BASE || 'same-origin'})`,
    );
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
