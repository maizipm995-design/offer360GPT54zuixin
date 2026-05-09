import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { StorageModule } from '../storage/storage.module';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';

@Module({
  imports: [StorageModule],
  controllers: [ServicesController],
  providers: [ServicesService, PrismaService],
  exports: [ServicesService],
})
export class ServicesModule {}
