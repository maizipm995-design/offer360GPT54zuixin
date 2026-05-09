import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { OSS_UPLOAD_SCENES } from '../storage.types';

export class CreateOssUploadSessionDto {
  @IsString()
  @IsIn(OSS_UPLOAD_SCENES)
  scene!: (typeof OSS_UPLOAD_SCENES)[number];

  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MaxLength(120)
  contentType!: string;

  @IsInt()
  @Min(1)
  fileSize!: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  bizId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  imageWidth?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  imageHeight?: number;
}
