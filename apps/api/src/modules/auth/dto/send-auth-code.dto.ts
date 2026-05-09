import { IsIn, IsMobilePhone } from 'class-validator';
import { AUTH_CODE_BUSINESSES } from '../auth-code.constants';

export class SendAuthCodeDto {
  @IsMobilePhone('zh-CN')
  phone!: string;

  @IsIn(AUTH_CODE_BUSINESSES)
  business!: (typeof AUTH_CODE_BUSINESSES)[number];
}
