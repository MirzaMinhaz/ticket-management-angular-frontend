import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { isLoggedIn, getUserRole } from '../utils/auth.utils';

export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (!isLoggedIn()) { router.navigate(['/']); return false; }
  if (getUserRole() === 'Admin') return true;
  router.navigate(['/customer/home']);
  return false;
};