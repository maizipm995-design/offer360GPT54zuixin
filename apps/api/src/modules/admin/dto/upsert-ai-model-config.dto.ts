import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpsertAiModelConfigDto {
  @IsString()
  @MaxLength(50)
  code!: string;

  @IsString()
  @IsIn(['volcengine-ark'])
  provider!: 'volcengine-ark';

  @IsString()
  @MaxLength(80)
  configName!: string;

  @IsString()
  @MaxLength(255)
  @IsUrl({
    require_protocol: true,
    require_tld: true,
  })
  baseUrl!: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsString()
  @MaxLength(100)
  modelName!: string;

  @IsString()
  @IsIn(['responses'])
  endpointType!: 'responses';

  @Type(() => Number)
  @IsInt()
  @Min(3000)
  @Max(60000)
  timeoutMs!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(128)
  @Max(8192)
  maxOutputTokens?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1)
  topP?: number;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsString()
  globalPromptTemplate?: string;

  @IsOptional()
  @IsString()
  entryPromptTemplate?: string;

  @IsOptional()
  @IsString()
  professionalPromptTemplate?: string;

  @IsOptional()
  @IsString()
  assessmentPromptTemplate?: string;

  @Type(() => Boolean)
  @IsBoolean()
  enabled!: boolean;

  @Type(() => Boolean)
  @IsBoolean()
  isDefault!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}
