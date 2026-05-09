import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentAdmin } from './decorators/current-admin.decorator';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminJwtAuthGuard } from './guards/admin-jwt-auth.guard';
import { AdminAuthService } from './admin-auth.service';

@ApiTags('admin-auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Get('bootstrap-status')
  getBootstrapStatus() {
    return this.adminAuthService.getBootstrapStatus();
  }

  @Post('bootstrap-register')
  bootstrapRegister(@Body() body: Record<string, unknown>) {
    return this.adminAuthService.bootstrapRegister(body);
  }

  @Post('login')
  login(@Body() dto: AdminLoginDto) {
    return this.adminAuthService.login(dto);
  }

  @Get('me')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  me(@CurrentAdmin() admin: { adminId: string }) {
    return this.adminAuthService.me(admin.adminId);
  }

  @Post('bootstrap-close')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  closeBootstrapEntry() {
    return this.adminAuthService.closeBootstrapEntry();
  }
}
