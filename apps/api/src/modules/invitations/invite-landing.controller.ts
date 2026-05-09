import { Controller, Get, Headers, Ip, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InvitationsService } from './invitations.service';

@ApiTags('invite-landing')
@Controller('invite-links')
export class InviteLandingController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Get(':randomKey')
  getLanding(@Param('randomKey') randomKey: string, @Ip() ip: string, @Headers('user-agent') userAgent?: string) {
    return this.invitationsService.getLanding(randomKey, { ip, userAgent });
  }
}
