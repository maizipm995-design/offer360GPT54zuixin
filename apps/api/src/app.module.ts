import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'path';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { CampusExamModule } from './modules/campus-exam/campus-exam.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { InterviewTranscriptModule } from './modules/interview-transcript/interview-transcript.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ResumeModule } from './modules/resume/resume.module';
import { ResumeAiModule } from './modules/resume-ai/resume-ai.module';
import { ServicesModule } from './modules/services/services.module';
import { StorageModule } from './modules/storage/storage.module';
import { UsersModule } from './modules/users/users.module';
import { RedisModule } from './common/redis/redis.module';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(process.cwd(), '.env'),
    }),
    RedisModule,
    AdminModule,
    AuthModule,
    CampusExamModule,
    DashboardModule,
    InterviewTranscriptModule,
    JobsModule,
    UsersModule,
    ServicesModule,
    InvitationsModule,
    OrdersModule,
    PaymentsModule,
    MembershipsModule,
    ResumeModule,
    ResumeAiModule,
    StorageModule,
  ],
  providers: [PrismaService],
})
export class AppModule {}
