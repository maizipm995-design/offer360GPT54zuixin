import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const RESUME_AI_ENTRY_SECTION_IDS = [
  'education',
  'internships',
  'projects',
  'campusRoles',
  'awards',
  'languages',
  'skills',
] as const;

export type ResumeAiEntrySectionId = (typeof RESUME_AI_ENTRY_SECTION_IDS)[number];

export class OptimizeResumeEntryDto {
  @IsString()
  @IsIn(RESUME_AI_ENTRY_SECTION_IDS)
  sectionId!: ResumeAiEntrySectionId;

  @IsString()
  @MaxLength(50)
  entryId!: string;

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
