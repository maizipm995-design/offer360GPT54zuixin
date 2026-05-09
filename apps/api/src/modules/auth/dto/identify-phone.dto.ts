import { IsMobilePhone } from 'class-validator';

export class IdentifyPhoneDto {
  @IsMobilePhone('zh-CN')
  phone!: string;
}
