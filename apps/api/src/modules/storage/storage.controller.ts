import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentAdmin, CurrentAdminPayload } from '../admin/decorators/current-admin.decorator';
import { AdminJwtAuthGuard } from '../admin/guards/admin-jwt-auth.guard';
import { CreateOssSignedObjectUrlDto } from './dto/create-oss-signed-object-url.dto';
import { CreateOssUploadSessionDto } from './dto/create-oss-upload-session.dto';
import { StorageService } from './storage.service';

@ApiTags('storage')
@Controller()
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('me/storage/oss-upload-sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  createUserUploadSession(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateOssUploadSessionDto) {
    return this.storageService.createUserUploadSession(user, dto);
  }

  @Post('me/storage/oss-signed-object-url')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  createUserSignedObjectUrl(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateOssSignedObjectUrlDto) {
    return this.storageService.createUserSignedObjectUrl(user, dto);
  }

  @Post('admin/storage/oss-upload-sessions')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  createAdminUploadSession(@CurrentAdmin() admin: CurrentAdminPayload, @Body() dto: CreateOssUploadSessionDto) {
    return this.storageService.createAdminUploadSession(admin, dto);
  }

  @Post('admin/storage/oss-signed-object-url')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  createAdminSignedObjectUrl(@CurrentAdmin() admin: CurrentAdminPayload, @Body() dto: CreateOssSignedObjectUrlDto) {
    return this.storageService.createAdminSignedObjectUrl(admin, dto);
  }
}
