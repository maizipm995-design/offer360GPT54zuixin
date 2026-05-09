import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

function normalizePreferenceArray(value: unknown) {
  if (!Array.isArray(value)) {
    return value;
  }

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : item))
    .filter((item): item is string => typeof item === 'string' && item.length > 0);
}

export class UpdatePreferencesDto {
  @IsOptional()
  @Transform(({ value }) => normalizePreferenceArray(value))
  @IsArray({ message: '意向城市格式不正确' })
  @ArrayMaxSize(5, { message: '意向城市最多填写 5 个' })
  @ArrayUnique({ message: '意向城市不能重复' })
  @MaxLength(24, { each: true, message: '单个意向城市不能超过 24 个字符' })
  @IsString({ each: true, message: '意向城市格式不正确' })
  intentionCity?: string[];

  @IsOptional()
  @Transform(({ value }) => normalizePreferenceArray(value))
  @IsArray({ message: '意向岗位格式不正确' })
  @ArrayMaxSize(5, { message: '意向岗位最多填写 5 个' })
  @ArrayUnique({ message: '意向岗位不能重复' })
  @MaxLength(24, { each: true, message: '单个意向岗位不能超过 24 个字符' })
  @IsString({ each: true, message: '意向岗位格式不正确' })
  intentionJob?: string[];

  @IsOptional()
  @Transform(({ value }) => normalizePreferenceArray(value))
  @IsArray({ message: '意向公司格式不正确' })
  @ArrayMaxSize(5, { message: '意向公司最多填写 5 个' })
  @ArrayUnique({ message: '意向公司不能重复' })
  @MaxLength(40, { each: true, message: '单个意向公司不能超过 40 个字符' })
  @IsString({ each: true, message: '意向公司格式不正确' })
  intentionCompany?: string[];
}
