import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { isLoggedIn, getUserRole } from '../utils/auth.utils';

export const customerGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (!isLoggedIn()) { router.navigate(['/customer/login']); return false; }
  if (getUserRole() === 'Customer') return true;
  router.navigate(['/home']);
  return false;
};