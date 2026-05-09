import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentAdminPayload {
  adminId: string;
  username: string;
  realName: string;
  phone?: string | null;
  email?: string | null;
  status: string;
  roleCodes: string[];
  permissions: string[];
  isSuperAdmin: boolean;
}

export const CurrentAdmin = createParamDecorator((_data: unknown, ctx: ExecutionContext): CurrentAdminPayload => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
