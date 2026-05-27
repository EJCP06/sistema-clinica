import { HttpInterceptorFn } from '@angular/common/http';
import { retry, delay } from 'rxjs/operators';

export const retryInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET') {
    return next(req);
  }

  return next(req).pipe(
    retry({ count: 5, delay: 2000 })
  );
};
