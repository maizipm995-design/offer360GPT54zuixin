import { IsIn } from 'class-validator';
import { JOB_ACCESS_CLICK_ACTION_TYPES } from '../jobs-recommendation.constants';

export class JobsClickDto {
  @IsIn(JOB_ACCESS_CLICK_ACTION_TYPES)
  actionType!: (typeof JOB_ACCESS_CLICK_ACTION_TYPES)[number];
}
