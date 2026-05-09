import { IsMobilePhone, IsString, Length } from 'class-validator';

export class UpdatePhoneDto {
  @IsMobilePhone('zh-CN')
  phone!: string;

  @IsString()
  @Length(4, 8)
  code!: string;
}
