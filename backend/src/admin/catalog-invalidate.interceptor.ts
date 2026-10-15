import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { tap } from 'rxjs/operators';
import { CatalogCache } from '../common/cache';

/** Setelah admin mengubah apa pun (non-GET), kosongkan cache menu agar perubahan langsung terlihat user. */
@Injectable()
export class CatalogInvalidate implements NestInterceptor {
  constructor(private cache: CatalogCache) {}
  intercept(ctx: ExecutionContext, next: CallHandler) {
    const write = ctx.switchToHttp().getRequest().method !== 'GET';
    return next.handle().pipe(tap({ next: () => write && this.cache.invalidate(), error: () => write && this.cache.invalidate() }));
  }
}
