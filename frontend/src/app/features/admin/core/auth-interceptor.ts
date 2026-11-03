import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { AdminAuth } from './admin-auth';

const PROTECTED = /\/api\/v1\/(admin\/|auth\/(me|change-password))/;

function withToken(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
}

/** Adds the admin bearer token to admin API calls and transparently refreshes it once on 401. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!PROTECTED.test(req.url)) return next(req);
  const auth = inject(AdminAuth);
  return next(withToken(req, auth.accessToken())).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || !auth.isLoggedIn()) return throwError(() => error);
      try {
        return auth.refresh().pipe(
          switchMap((token) => next(withToken(req, token))),
          catchError((refreshError: unknown) => {
            auth.expire();
            return throwError(() => refreshError);
          }),
        );
      } catch {
        auth.expire();
        return throwError(() => error);
      }
    }),
  );
};
