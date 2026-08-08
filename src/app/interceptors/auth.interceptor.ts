// src/app/interceptors/auth.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { performLogout, isLoggedIn } from '../utils/auth.utils';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  // Attach the token if present.
  const token = localStorage.getItem('jwtToken');
  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error) => {
      if (error.status === 401 || error.status === 403) {
        // The backend rejected this request as unauthorized — whether
        // because the token is missing, expired, or was invalidated.
        // Log out fully and bounce to login, so a "zombie" tab can never
        // successfully save anything even in the race-condition window.
        if (isLoggedIn()) {
          performLogout();
        }
        router.navigate(['/']);
      }
      return throwError(() => error);
    }),
  );
};