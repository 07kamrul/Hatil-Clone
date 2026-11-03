import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AdminAuth } from './admin-auth';

export const adminGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AdminAuth);
  const router = inject(Router);
  if (auth.user()) return true;
  if (auth.isLoggedIn() && (await auth.loadUser())) return true;
  return router.createUrlTree(['/admin/login'], { queryParams: { next: state.url } });
};

export const superAdminGuard: CanActivateFn = () => {
  const auth = inject(AdminAuth);
  return auth.isSuperAdmin() || inject(Router).createUrlTree(['/admin']);
};
