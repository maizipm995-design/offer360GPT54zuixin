import { SetMetadata } from '@nestjs/common';

export const ADMIN_PERMISSIONS_KEY = 'admin_permissions';

export const RequireAdminPermissions = (...permissions: string[]) => SetMetadata(ADMIN_PERMISSIONS_KEY, permissions);
