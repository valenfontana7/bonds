import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const isAuthEndpoint =
        req.url.includes('/api/auth/login') || req.url.includes('/api/auth/register');

      if (error.status === 401 && auth.isLoggedIn() && !isAuthEndpoint) {
        auth.logout();
        void router.navigateByUrl('/bienvenida');
      }

      return throwError(() => error);
    }),
  );
};
