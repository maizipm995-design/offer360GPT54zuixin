import { IsArray, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateResumeDraftDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsObject()
  contentJson?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  styleJson?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  layoutJson?: Array<Record<string, unknown>>;
}
