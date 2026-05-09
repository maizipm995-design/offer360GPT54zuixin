import { IsIn, IsMobilePhone, IsString, Length } from 'class-validator';
import { AUTH_CODE_BUSINESSES } from '../auth-code.constants';

export class VerifyAuthCodeDto {
  @IsMobilePhone('zh-CN')
  phone!: string;

  @IsIn(AUTH_CODE_BUSINESSES)
  business!: (typeof AUTH_CODE_BUSINESSES)[number];

  @IsString()
  @Length(4, 8)
  code!: string;
}
