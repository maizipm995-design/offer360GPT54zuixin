import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CurrentAdminPayload } from '../decorators/current-admin.decorator';
import { ADMIN_PERMISSIONS_KEY } from '../decorators/require-admin-permissions.decorator';

@Injectable()
export class AdminPermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(ADMIN_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: CurrentAdminPayload }>();
    const admin = request.user;

    if (!admin) {
      throw new ForbiddenException('后台登录状态已失效');
    }

    if (admin.isSuperAdmin) {
      return true;
    }

    const hasPermission = requiredPermissions.every((permission) => admin.permissions.includes(permission));
    if (!hasPermission) {
      throw new ForbiddenException('暂无权限访问该后台资源');
    }

    return true;
  }
}
