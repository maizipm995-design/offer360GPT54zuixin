import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MembershipsService } from './memberships.service';

@ApiTags('memberships')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me/membership')
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Get()
  getCurrent(@CurrentUser() user: CurrentUserPayload) {
    return this.membershipsService.getCurrent(user.userId);
  }

  @Post('open')
  open(@CurrentUser() user: CurrentUserPayload, @Body() body: { days?: number; memberLevel?: string }) {
    return this.membershipsService.openMembership(user.userId, body);
  }

  @Post('redeem')
  redeem(@CurrentUser() user: CurrentUserPayload, @Body('code') code?: string) {
    return this.membershipsService.redeemMembership(user.userId, code ?? '');
  }
}
