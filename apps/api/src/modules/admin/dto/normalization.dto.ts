import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  NORMALIZATION_LOCATION_LEVELS,
  NORMALIZATION_MATCH_MODES,
  NORMALIZATION_RECORD_STATUSES,
} from '../admin-normalization.constants';
import { JOBS_NORMALIZATION_DOMAINS, type JobsNormalizationDomain } from '../../jobs/jobs-normalization.types';

export class NormalizationPaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class ListNormalizationTermsQueryDto extends NormalizationPaginationQueryDto {
  @IsOptional()
  @IsIn(JOBS_NORMALIZATION_DOMAINS)
  domain?: JobsNormalizationDomain;

  @IsOptional()
  @IsIn(NORMALIZATION_RECORD_STATUSES)
  status?: (typeof NORMALIZATION_RECORD_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(60)
  keyword?: string;
}

export class CreateNormalizationTermDto {
  @IsIn(JOBS_NORMALIZATION_DOMAINS)
  domain!: JobsNormalizationDomain;

  @IsString()
  @MaxLength(120)
  canonicalName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  canonicalCode?: string;

  @IsOptional()
  @IsIn(NORMALIZATION_LOCATION_LEVELS)
  level?: (typeof NORMALIZATION_LOCATION_LEVELS)[number];

  @IsOptional()
  @IsIn(NORMALIZATION_RECORD_STATUSES)
  status?: (typeof NORMALIZATION_RECORD_STATUSES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateNormalizationTermDto {
  @IsOptional()
  @IsIn(JOBS_NORMALIZATION_DOMAINS)
  domain?: JobsNormalizationDomain;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  canonicalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  canonicalCode?: string;

  @IsOptional()
  @IsIn(NORMALIZATION_LOCATION_LEVELS)
  level?: (typeof NORMALIZATION_LOCATION_LEVELS)[number];

  @IsOptional()
  @IsIn(NORMALIZATION_RECORD_STATUSES)
  status?: (typeof NORMALIZATION_RECORD_STATUSES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ListNormalizationAliasesQueryDto extends NormalizationPaginationQueryDto {
  @IsOptional()
  @IsIn(NORMALIZATION_RECORD_STATUSES)
  status?: (typeof NORMALIZATION_RECORD_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(60)
  keyword?: string;
}

export class CreateNormalizationAliasDto {
  @IsString()
  @MaxLength(120)
  aliasName!: string;

  @IsOptional()
  @IsIn(NORMALIZATION_MATCH_MODES)
  matchMode?: (typeof NORMALIZATION_MATCH_MODES)[number];

  @IsOptional()
  @IsIn(NORMALIZATION_RECORD_STATUSES)
  status?: (typeof NORMALIZATION_RECORD_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(30)
  source?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class UpdateNormalizationAliasDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  aliasName?: string;

  @IsOptional()
  @IsIn(NORMALIZATION_MATCH_MODES)
  matchMode?: (typeof NORMALIZATION_MATCH_MODES)[number];

  @IsOptional()
  @IsIn(NORMALIZATION_RECORD_STATUSES)
  status?: (typeof NORMALIZATION_RECORD_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(30)
  source?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class ListLocationHierarchiesQueryDto extends NormalizationPaginationQueryDto {
  @IsOptional()
  @IsString()
  provinceTermId?: string;

  @IsOptional()
  @IsIn(NORMALIZATION_RECORD_STATUSES)
  status?: (typeof NORMALIZATION_RECORD_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(60)
  keyword?: string;
}

export class CreateLocationHierarchyDto {
  @IsString()
  provinceTermId!: string;

  @IsString()
  cityTermId!: string;

  @IsOptional()
  @IsIn(NORMALIZATION_RECORD_STATUSES)
  status?: (typeof NORMALIZATION_RECORD_STATUSES)[number];
}

export class UpdateLocationHierarchyDto {
  @IsOptional()
  @IsString()
  provinceTermId?: string;

  @IsOptional()
  @IsString()
  cityTermId?: string;

  @IsOptional()
  @IsIn(NORMALIZATION_RECORD_STATUSES)
  status?: (typeof NORMALIZATION_RECORD_STATUSES)[number];
}
