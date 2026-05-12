import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { env } from '../../config/env';
import { PrismaService } from '../../prisma.service';
import { JobsModule } from '../jobs/jobs.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { PaymentsModule } from '../payments/payments.module';
import { StorageModule } from '../storage/storage.module';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminBulkController } from './admin-bulk.controller';
import { AdminBulkService } from './admin-bulk.service';
import { AdminController } from './admin.controller';
import { AdminGovernanceController } from './admin-governance.controller';
import { AdminGovernanceService } from './admin-governance.service';
import { AdminNormalizationBulkController } from './admin-normalization-bulk.controller';
import { AdminNormalizationBulkService } from './admin-normalization-bulk.service';
import { AdminNormalizationController } from './admin-normalization.controller';
import { AdminNormalizationService } from './admin-normalization.service';
import { AdminOperationLogInterceptor } from './admin-operation-log.interceptor';
import { AdminOperationLogService } from './admin-operation-log.service';
import { AdminRedeemController } from './admin-redeem.controller';
import { AdminRedeemService } from './admin-redeem.service';
import { AdminService } from './admin.service';
import { AdminPermissionGuard } from './guards/admin-permission.guard';
import { AdminJwtStrategy } from './strategies/admin-jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: env.jwtSecret,
      signOptions: { expiresIn: '7d' },
    }),
    JobsModule,
    MembershipsModule,
    PaymentsModule,
    StorageModule,
  ],
  controllers: [
    AdminAuthController,
    AdminController,
    AdminBulkController,
    AdminRedeemController,
    AdminGovernanceController,
    AdminNormalizationController,
    AdminNormalizationBulkController,
  ],
  providers: [
    AdminAuthService,
    AdminBulkService,
    AdminGovernanceService,
    AdminNormalizationService,
    AdminNormalizationBulkService,
    AdminOperationLogService,
    AdminRedeemService,
    AdminService,
    AdminPermissionGuard,
    AdminJwtStrategy,
    PrismaService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AdminOperationLogInterceptor,
    },
  ],
})
export class AdminModule {}
