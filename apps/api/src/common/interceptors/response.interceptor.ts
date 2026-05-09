import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, { success: true; message: string; data: T }> {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<{ success: true; message: string; data: T }> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        message: 'ok',
        data,
      })),
    );
  }
}
