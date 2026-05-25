import { IsOptional, IsString, MaxLength } from 'class-validator';

export class OptimizeResumeProfessionalDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobTarget?: string;
}
