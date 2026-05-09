import { IsIn } from 'class-validator';
import { PROGRESS_STATUS_OPTIONS } from '@offer360/shared';

export class UpdateProgressDto {
  @IsIn(PROGRESS_STATUS_OPTIONS.filter((item) => item !== '全部'))
  progressStatus!: string;
}
