import { HttpInterceptorFn } from '@angular/common/http';
import { inject, NgZone } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * Interceptor que asegura que todas las respuestas HTTP
 * se ejecuten dentro del NgZone de Angular.
 */
export const zoneInterceptor: HttpInterceptorFn = (req, next) => {
  const ngZone = inject(NgZone);
  return new Observable((subscriber) => {
    const sub = next(req).subscribe({
      next(value) { ngZone.run(() => subscriber.next(value)); },
      error(err) { ngZone.run(() => subscriber.error(err)); },
      complete() { ngZone.run(() => subscriber.complete()); },
    });
    return () => sub.unsubscribe();
  });
};
