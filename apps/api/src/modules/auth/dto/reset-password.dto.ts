import { IsMobilePhone, IsString, Length } from 'class-validator';

export class ResetPasswordDto {
  @IsMobilePhone('zh-CN')
  phone!: string;

  @IsString()
  @Length(4, 8)
  code!: string;

  @IsString()
  @Length(8, 32)
  newPassword!: string;
}
