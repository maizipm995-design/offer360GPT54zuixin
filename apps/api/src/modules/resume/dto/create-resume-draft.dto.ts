import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateResumeDraftDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;
}
