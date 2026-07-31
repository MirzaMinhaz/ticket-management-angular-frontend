import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { isLoggedIn, hasRole } from '../utils/auth.utils';

const STAFF_ROLES = ['Admin', 'Manager', 'StationAgent', 'CounterAgent'];

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (!isLoggedIn()) { router.navigate(['/']); return false; }
  if (STAFF_ROLES.some(role => hasRole(role))) return true;
  router.navigate(['/customer/home']);
  return false;
};