import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MembershipsModule } from '../memberships/memberships.module';
import { env } from '../../config/env';
import { PrismaService } from '../../prisma.service';
import { AliyunSmsService } from './aliyun-sms.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './auth.strategy';
import { PhoneVerificationService } from './phone-verification.service';

@Module({
  imports: [
    PassportModule,
    MembershipsModule,
    JwtModule.register({
      secret: env.jwtSecret,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, PrismaService, AliyunSmsService, PhoneVerificationService],
  exports: [AuthService, JwtModule, PhoneVerificationService],
})
export class AuthModule {}
