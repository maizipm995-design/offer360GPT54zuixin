import { IsString, Length } from 'class-validator';

export class AdminLoginDto {
  @IsString()
  @Length(1, 100)
  account!: string;

  @IsString()
  @Length(6, 100)
  password!: string;
}
