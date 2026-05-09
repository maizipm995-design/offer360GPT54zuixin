import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CurrentAdminPayload } from './decorators/current-admin.decorator';
import { AdminOperationLogService } from './admin-operation-log.service';

@Injectable()
export class AdminOperationLogInterceptor implements NestInterceptor {
  constructor(private readonly operationLogService: AdminOperationLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<{
      method?: string;
      originalUrl?: string;
      params?: Record<string, string>;
      body?: unknown;
      ip?: string;
      headers?: Record<string, string | string[] | undefined>;
      user?: CurrentAdminPayload;
    }>();

    const method = (request.method || 'GET').toUpperCase();
    const path = request.originalUrl?.split('?')[0] || '';
    const admin = request.user;

    if (!admin?.adminId || !path.startsWith('/api/admin') || ['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return next.handle();
    }

    const [moduleName, actionName] = this.resolveModuleAndAction(path, method, request.params || {});
    const targetId = request.params?.id || request.params?.randomKey || null;
    const targetType = moduleName;
    const userAgentHeader = request.headers?.['user-agent'];
    const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader;
    const payload = this.operationLogService.sanitizePayload(request.body);

    return next.handle().pipe(
      tap((data) => {
        void this.operationLogService.record({
          adminUserId: admin.adminId,
          module: moduleName,
          action: actionName,
          targetType,
          targetId,
          requestMethod: method,
          requestPath: path,
          requestPayload: payload,
          responseSummary: this.operationLogService.summarizeResponse(data),
          ip: request.ip || null,
          userAgent: userAgent || null,
        });
      }),
    );
  }

  private resolveModuleAndAction(path: string, method: string, params: Record<string, string>) {
    const normalizedPath = path.replace(/^\/api\/admin\/?/, '');
    const firstSegment = normalizedPath.split('/')[0] || 'unknown';
    const moduleName = firstSegment || 'unknown';

    if (normalizedPath.includes('/import')) {
      return [moduleName, 'import'];
    }
    if (normalizedPath.includes('/export')) {
      return [moduleName, 'export'];
    }
    if (normalizedPath.includes('/template')) {
      return [moduleName, 'download-template'];
    }
    if (normalizedPath.endsWith('/status') || Object.prototype.hasOwnProperty.call(params, 'id') && normalizedPath.endsWith(`${params.id}/status`)) {
      return [moduleName, 'update-status'];
    }
    if (normalizedPath.endsWith('/reset-password')) {
      return [moduleName, 'reset-password'];
    }

    if (method === 'POST') return [moduleName, 'create'];
    if (method === 'PATCH') return [moduleName, 'update'];
    if (method === 'DELETE') return [moduleName, 'delete'];
    return [moduleName, method.toLowerCase()];
  }
}
