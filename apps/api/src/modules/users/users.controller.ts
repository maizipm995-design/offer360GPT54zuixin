import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdatePhoneDto } from './dto/update-phone.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('overview')
  getOverview(@CurrentUser() user: CurrentUserPayload) {
    return this.usersService.getOverview(user.userId);
  }

  @Put('profile')
  updateProfile(@CurrentUser() user: CurrentUserPayload, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.userId, dto);
  }

  @Get('preferences')
  getPreferences(@CurrentUser() user: CurrentUserPayload) {
    return this.usersService.getPreferences(user.userId);
  }

  @Put('preferences')
  updatePreferences(@CurrentUser() user: CurrentUserPayload, @Body() dto: UpdatePreferencesDto) {
    return this.usersService.updatePreferences(user.userId, dto);
  }

  @Put('phone')
  updatePhone(@CurrentUser() user: CurrentUserPayload, @Body() dto: UpdatePhoneDto) {
    return this.usersService.updatePhone(user.userId, dto);
  }

  @Put('password')
  updatePassword(@CurrentUser() user: CurrentUserPayload, @Body() dto: UpdatePasswordDto) {
    return this.usersService.updatePassword(user.userId, dto);
  }
}
