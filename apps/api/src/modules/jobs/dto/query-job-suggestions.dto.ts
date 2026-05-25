import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

function toTrimmedString(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  return normalized || undefined;
}

export class QueryJobSuggestionsDto {
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  keyword!: string;

  @IsOptional()
  @Transform(({ value }) => toTrimmedString(value))
  @IsIn(['general', 'location', 'job', 'company'])
  field?: 'general' | 'location' | 'job' | 'company';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  limit?: number = 8;
}
