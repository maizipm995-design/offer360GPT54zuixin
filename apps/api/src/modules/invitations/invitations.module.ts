import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { InviteLandingController } from './invite-landing.controller';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';

@Module({
  controllers: [InvitationsController, InviteLandingController],
  providers: [InvitationsService, PrismaService],
})
export class InvitationsModule {}
