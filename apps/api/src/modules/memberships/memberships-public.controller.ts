import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MembershipsService } from './memberships.service';

@ApiTags('membership-page')
@Controller('membership-page')
export class MembershipsPublicController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Get('benefits')
  getBenefitsContent() {
    return this.membershipsService.getBenefitsContent();
  }

  @Get('plans')
  getPlans() {
    return this.membershipsService.getPlans();
  }

  @Get('career-journey')
  getCareerJourneyContent() {
    return this.membershipsService.getCareerJourneyContent();
  }
}
