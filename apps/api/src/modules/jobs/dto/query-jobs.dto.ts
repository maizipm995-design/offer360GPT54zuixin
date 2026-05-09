import { Transform, Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

function toTrimmedString(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  return normalized || undefined;
}

function toStringArray(value: unknown) {
  const values = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  const normalized = values
    .map((item) => String(item).trim())
    .filter(Boolean);

  return normalized.length ? normalized : undefined;
}

function toNumberArray(value: unknown) {
  const normalized = toStringArray(value)
    ?.map((item) => Number(item))
    .filter((item) => Number.isInteger(item));

  return normalized?.length ? normalized : undefined;
}

export class QueryJobsDto {
  @IsOptional()
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  keyword?: string;

  @IsOptional()
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  cityKeyword?: string;

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  degreeRequirement?: string[];

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  enterpriseNature?: string[];

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  recruitmentType?: string[];

  @IsOptional()
  @Transform(({ value }) => toNumberArray(value))
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(30, { each: true })
  updatedWithinDays?: number[];

  @IsOptional()
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  companyName?: string;

  @IsOptional()
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  positionName?: string;

  @IsOptional()
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  major?: string;

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  workLocation?: string[];

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  degree?: string[];

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  jobType?: string[];

  @IsOptional()
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  progressStatus?: string;

  @IsOptional()
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  userId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
