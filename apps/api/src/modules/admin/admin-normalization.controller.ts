import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequireAdminPermissions } from './decorators/require-admin-permissions.decorator';
import { AdminJwtAuthGuard } from './guards/admin-jwt-auth.guard';
import { AdminPermissionGuard } from './guards/admin-permission.guard';
import { AdminNormalizationService } from './admin-normalization.service';
import {
  CreateLocationHierarchyDto,
  CreateNormalizationAliasDto,
  CreateNormalizationTermDto,
  ListLocationHierarchiesQueryDto,
  ListNormalizationAliasesQueryDto,
  ListNormalizationTermsQueryDto,
  UpdateLocationHierarchyDto,
  UpdateNormalizationAliasDto,
  UpdateNormalizationTermDto,
} from './dto/normalization.dto';

@ApiTags('admin-normalization')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
@Controller('admin')
export class AdminNormalizationController {
  constructor(private readonly adminNormalizationService: AdminNormalizationService) {}

  @Get('normalization-summary')
  @RequireAdminPermissions('admin:job:manage')
  getSummary() {
    return this.adminNormalizationService.getSummary();
  }

  @Get('normalization-terms')
  @RequireAdminPermissions('admin:job:manage')
  getTerms(@Query() query: ListNormalizationTermsQueryDto) {
    return this.adminNormalizationService.getTerms(query);
  }

  @Post('normalization-terms')
  @RequireAdminPermissions('admin:job:manage')
  createTerm(@Body() body: CreateNormalizationTermDto) {
    return this.adminNormalizationService.createTerm(body);
  }

  @Patch('normalization-terms/:id')
  @RequireAdminPermissions('admin:job:manage')
  updateTerm(@Param('id') id: string, @Body() body: UpdateNormalizationTermDto) {
    return this.adminNormalizationService.updateTerm(id, body);
  }

  @Delete('normalization-terms/:id')
  @RequireAdminPermissions('admin:job:manage')
  deleteTerm(@Param('id') id: string) {
    return this.adminNormalizationService.deleteTerm(id);
  }

  @Get('normalization-terms/:id/aliases')
  @RequireAdminPermissions('admin:job:manage')
  getAliases(@Param('id') id: string, @Query() query: ListNormalizationAliasesQueryDto) {
    return this.adminNormalizationService.getAliases(id, query);
  }

  @Post('normalization-terms/:id/aliases')
  @RequireAdminPermissions('admin:job:manage')
  createAlias(@Param('id') id: string, @Body() body: CreateNormalizationAliasDto) {
    return this.adminNormalizationService.createAlias(id, body);
  }

  @Patch('normalization-aliases/:id')
  @RequireAdminPermissions('admin:job:manage')
  updateAlias(@Param('id') id: string, @Body() body: UpdateNormalizationAliasDto) {
    return this.adminNormalizationService.updateAlias(id, body);
  }

  @Delete('normalization-aliases/:id')
  @RequireAdminPermissions('admin:job:manage')
  deleteAlias(@Param('id') id: string) {
    return this.adminNormalizationService.deleteAlias(id);
  }

  @Get('location-hierarchies')
  @RequireAdminPermissions('admin:job:manage')
  getLocationHierarchies(@Query() query: ListLocationHierarchiesQueryDto) {
    return this.adminNormalizationService.getLocationHierarchies(query);
  }

  @Post('location-hierarchies')
  @RequireAdminPermissions('admin:job:manage')
  createLocationHierarchy(@Body() body: CreateLocationHierarchyDto) {
    return this.adminNormalizationService.createLocationHierarchy(body);
  }

  @Patch('location-hierarchies/:id')
  @RequireAdminPermissions('admin:job:manage')
  updateLocationHierarchy(@Param('id') id: string, @Body() body: UpdateLocationHierarchyDto) {
    return this.adminNormalizationService.updateLocationHierarchy(id, body);
  }

  @Delete('location-hierarchies/:id')
  @RequireAdminPermissions('admin:job:manage')
  deleteLocationHierarchy(@Param('id') id: string) {
    return this.adminNormalizationService.deleteLocationHierarchy(id);
  }
}
