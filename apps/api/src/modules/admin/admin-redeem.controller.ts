import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentAdmin, CurrentAdminPayload } from './decorators/current-admin.decorator';
import { RequireAdminPermissions } from './decorators/require-admin-permissions.decorator';
import { AdminJwtAuthGuard } from './guards/admin-jwt-auth.guard';
import { AdminPermissionGuard } from './guards/admin-permission.guard';
import { AdminRedeemService } from './admin-redeem.service';

@ApiTags('admin-redeem')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
@Controller('admin')
export class AdminRedeemController {
  constructor(private readonly adminRedeemService: AdminRedeemService) {}

  @Get('redeem-batches')
  @RequireAdminPermissions('admin:redeem:manage')
  getRedeemBatches(@Query() query: Record<string, string | undefined>) {
    return this.adminRedeemService.getRedeemBatches(query);
  }

  @Post('redeem-batches')
  @RequireAdminPermissions('admin:redeem:manage')
  createRedeemBatch(@Body() body: Record<string, unknown>, @CurrentAdmin() admin: CurrentAdminPayload) {
    return this.adminRedeemService.createRedeemBatch(body, admin.adminId);
  }

  @Patch('redeem-batches/:id')
  @RequireAdminPermissions('admin:redeem:manage')
  updateRedeemBatch(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.adminRedeemService.updateRedeemBatch(id, body);
  }

  @Get('redeem-codes')
  @RequireAdminPermissions('admin:redeem:manage')
  getRedeemCodes(@Query() query: Record<string, string | undefined>) {
    return this.adminRedeemService.getRedeemCodes(query);
  }

  @Get('redeem-codes/export')
  @RequireAdminPermissions('admin:redeem:manage')
  exportRedeemCodes(@Query() query: Record<string, string | undefined>) {
    return this.adminRedeemService.exportRedeemCodes(query);
  }

  @Get('redeem-records')
  @RequireAdminPermissions('admin:redeem:manage')
  getRedeemRecords(@Query() query: Record<string, string | undefined>) {
    return this.adminRedeemService.getRedeemRecords(query);
  }

  @Patch('redeem-codes/:id')
  @RequireAdminPermissions('admin:redeem:manage')
  updateRedeemCode(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentAdmin() admin: CurrentAdminPayload) {
    return this.adminRedeemService.updateRedeemCode(id, body, admin.adminId);
  }
}
