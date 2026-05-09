import { IsMobilePhone, IsString, Length } from 'class-validator';

export class LoginDto {
  @IsMobilePhone('zh-CN')
  phone!: string;

  @IsString()
  @Length(8, 32)
  password!: string;
}
