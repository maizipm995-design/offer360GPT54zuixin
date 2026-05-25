import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateInterviewTranscriptTaskDto {
  @IsString()
  @MaxLength(191)
  companyName!: string;

  @IsString()
  @MaxLength(191)
  jobName!: string;

  @IsString()
  @IsIn(['通用综合面试', 'HR面试', '业务面试', '总监面试', 'AI面试'])
  interviewType!: string;

  @IsOptional()
  @IsString()
  jobRequirement?: string;

  @IsString()
  @IsIn(['structured', 'upload'])
  resumeMode!: 'structured' | 'upload';

  @IsOptional()
  @IsString()
  structuredResume?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  structuredResumeTitle?: string;
}
