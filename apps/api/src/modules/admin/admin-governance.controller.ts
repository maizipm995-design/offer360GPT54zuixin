import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentAdmin, CurrentAdminPayload } from './decorators/current-admin.decorator';
import { RequireAdminPermissions } from './decorators/require-admin-permissions.decorator';
import { AdminJwtAuthGuard } from './guards/admin-jwt-auth.guard';
import { AdminPermissionGuard } from './guards/admin-permission.guard';
import { AdminGovernanceService } from './admin-governance.service';

@ApiTags('admin-governance')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
@Controller('admin')
export class AdminGovernanceController {
  constructor(private readonly adminGovernanceService: AdminGovernanceService) {}

  @Get('permission-catalog')
  @RequireAdminPermissions('admin:role:manage')
  getPermissionCatalog() {
    return this.adminGovernanceService.getPermissionCatalog();
  }

  @Get('admin-users')
  @RequireAdminPermissions('admin:admin-user:manage')
  getAdminUsers(@Query() query: Record<string, string | undefined>) {
    return this.adminGovernanceService.getAdminUsers(query);
  }

  @Post('admin-users')
  @RequireAdminPermissions('admin:admin-user:manage')
  createAdminUser(@Body() body: Record<string, unknown>) {
    return this.adminGovernanceService.createAdminUser(body);
  }

  @Patch('admin-users/:id')
  @RequireAdminPermissions('admin:admin-user:manage')
  updateAdminUser(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentAdmin() admin: CurrentAdminPayload) {
    return this.adminGovernanceService.updateAdminUser(id, body, admin.adminId);
  }

  @Delete('admin-users/:id')
  @RequireAdminPermissions('admin:admin-user:manage')
  deleteAdminUser(@Param('id') id: string, @CurrentAdmin() admin: CurrentAdminPayload) {
    return this.adminGovernanceService.deleteAdminUser(id, admin.adminId);
  }

  @Get('admin-roles')
  @RequireAdminPermissions('admin:role:manage')
  getAdminRoles(@Query() query: Record<string, string | undefined>) {
    return this.adminGovernanceService.getAdminRoles(query);
  }

  @Post('admin-roles')
  @RequireAdminPermissions('admin:role:manage')
  createAdminRole(@Body() body: Record<string, unknown>) {
    return this.adminGovernanceService.createAdminRole(body);
  }

  @Patch('admin-roles/:id')
  @RequireAdminPermissions('admin:role:manage')
  updateAdminRole(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.adminGovernanceService.updateAdminRole(id, body);
  }

  @Delete('admin-roles/:id')
  @RequireAdminPermissions('admin:role:manage')
  deleteAdminRole(@Param('id') id: string) {
    return this.adminGovernanceService.deleteAdminRole(id);
  }

  @Get('operation-logs')
  @RequireAdminPermissions('admin:operation-log:view')
  getOperationLogs(@Query() query: Record<string, string | undefined>) {
    return this.adminGovernanceService.getOperationLogs(query);
  }

  @Patch('orders/:id/status')
  @RequireAdminPermissions('admin:service:manage')
  updateOrderStatus(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.adminGovernanceService.updateOrderStatus(id, body);
  }

  @Post('orders/:id/reconcile')
  @RequireAdminPermissions('admin:service:manage')
  reconcileOrder(@Param('id') id: string) {
    return this.adminGovernanceService.reconcileOrder(id);
  }

  @Post('orders/reconcile')
  @RequireAdminPermissions('admin:service:manage')
  reconcileRecentOrders(@Body() body: Record<string, unknown>) {
    return this.adminGovernanceService.reconcileRecentOrders(body);
  }

  @Patch('users/:id/status')
  @RequireAdminPermissions('admin:user:manage')
  updateUserStatus(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.adminGovernanceService.updateUserStatus(id, body);
  }

  @Patch('users/:id/reset-password')
  @RequireAdminPermissions('admin:user:manage')
  resetUserPassword(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.adminGovernanceService.resetUserPassword(id, body);
  }
}
