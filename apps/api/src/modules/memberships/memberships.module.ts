import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { StorageModule } from '../storage/storage.module';
import { MembershipsController } from './memberships.controller';
import { MembershipsPublicController } from './memberships-public.controller';
import { MembershipsService } from './memberships.service';

@Module({
  imports: [StorageModule],
  controllers: [MembershipsController, MembershipsPublicController],
  providers: [MembershipsService, PrismaService],
  exports: [MembershipsService],
})
export class MembershipsModule {}
