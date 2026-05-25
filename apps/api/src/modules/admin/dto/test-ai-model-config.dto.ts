import { IsOptional, IsString, MaxLength } from 'class-validator';

export class TestAiModelConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  prompt?: string;
}
