// src/app/guards/auth.guard.ts
import { inject } from '@angular/core';
import { Router, UrlTree } from '@angular/router';

export const authGuard = (): boolean | UrlTree => {
  const router = inject(Router);
  const token = localStorage.getItem('jwtToken');

  if (token) {
    return true; // ✅ allow access
  }

  // ❌ no token → redirect to login
  return router.parseUrl('/');
};
