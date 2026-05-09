import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { CodeLoginDto } from './dto/code-login.dto';
import { IdentifyPhoneDto } from './dto/identify-phone.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SendAuthCodeDto } from './dto/send-auth-code.dto';
import { VerifyAuthCodeDto } from './dto/verify-auth-code.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly _jwtService: JwtService,
  ) {}

  @Post('identify')
  identify(@Body() dto: IdentifyPhoneDto) {
    return this.authService.identifyPhone(dto);
  }

  @Post('send-code')
  sendCode(@Body() dto: SendAuthCodeDto) {
    return this.authService.sendCode(dto);
  }

  @Post('verify-code')
  verifyCode(@Body() dto: VerifyAuthCodeDto) {
    return this.authService.verifyCode(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('login/code')
  loginByCode(@Body() dto: CodeLoginDto) {
    return this.authService.loginWithCode(dto);
  }

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('password/reset')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  me(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.me(user.userId);
  }
}
