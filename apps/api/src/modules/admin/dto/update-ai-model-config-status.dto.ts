import { Type } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class UpdateAiModelConfigStatusDto {
  @Type(() => Boolean)
  @IsBoolean()
  enabled!: boolean;
}
