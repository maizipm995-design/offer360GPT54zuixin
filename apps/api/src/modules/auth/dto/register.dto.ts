import { IsMobilePhone, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsMobilePhone('zh-CN')
  phone!: string;

  @IsString()
  @Length(8, 32)
  password!: string;

  @IsString()
  @Length(4, 8)
  verificationCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  inviteCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  inviteToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;
}
