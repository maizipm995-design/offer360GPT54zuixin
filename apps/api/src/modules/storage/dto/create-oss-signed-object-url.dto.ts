import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { OSS_UPLOAD_SCENES } from '../storage.types';

export class CreateOssSignedObjectUrlDto {
  @IsString()
  @IsIn(OSS_UPLOAD_SCENES)
  scene!: (typeof OSS_UPLOAD_SCENES)[number];

  @IsString()
  @MaxLength(500)
  objectKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(24 * 60 * 60)
  expiresSeconds?: number;
}
