import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { isLoggedIn, hasRole } from '../utils/auth.utils';

export const adminOrManagerGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (!isLoggedIn()) { router.navigate(['/']); return false; }
  if (hasRole('Admin') || hasRole('Manager')) return true;
  // Logged in, but not privileged enough — send back to their own home
  // rather than the login page, since they do have a valid staff session.
  router.navigate(['/home']);
  return false;
};