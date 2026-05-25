import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const RESUME_AI_TRANSLATE_DIRECTIONS = ['zh-to-en', 'en-to-zh'] as const;

export type ResumeAiTranslateDirection = (typeof RESUME_AI_TRANSLATE_DIRECTIONS)[number];

export class TranslateResumeDto {
  @IsString()
  @IsIn(RESUME_AI_TRANSLATE_DIRECTIONS)
  direction!: ResumeAiTranslateDirection;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobTarget?: string;
}
