import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const RESUME_AI_SECTION_IDS = ['selfEvaluation', 'personalSummary'] as const;

export type ResumeAiSectionId = (typeof RESUME_AI_SECTION_IDS)[number];

export class OptimizeResumeSectionDto {
  @IsString()
  @IsIn(RESUME_AI_SECTION_IDS)
  sectionId!: ResumeAiSectionId;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  tone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobTarget?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  selectedSuggestion?: string;
}
