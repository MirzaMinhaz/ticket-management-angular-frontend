// src/app/interceptors/auth.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  console.log('🔥 INTERCEPTOR HIT:', req.url);
  const token = localStorage.getItem('jwtToken');
  console.log('🔥 TOKEN:', token ? 'EXISTS' : 'MISSING');

  if (token) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
    console.log('🔥 HEADER ATTACHED');
  }

  return next(req);
};