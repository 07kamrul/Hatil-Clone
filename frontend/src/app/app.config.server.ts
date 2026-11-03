import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';

import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { API_BASE, SITE_ORIGIN } from './core/config';

// On the server the API is reached over the internal network (docker service name or localhost).
const apiInternal = (process.env['API_INTERNAL_URL'] ?? 'http://localhost:8000').replace(/\/$/, '');
const publicOrigin = (process.env['PUBLIC_BASE_URL'] ?? 'http://localhost').replace(/\/$/, '');

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    { provide: API_BASE, useValue: `${apiInternal}/api/v1` },
    { provide: SITE_ORIGIN, useValue: publicOrigin },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
