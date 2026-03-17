import { Body, Controller, Patch, Req, UseGuards } from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AuthGuard } from '../common/guards/auth.guard';

@Controller('profiles')
export class ProfilesController {
  constructor(private profilesService: ProfilesService) {}

  @Patch('me')
  @UseGuards(AuthGuard)
  updateProfile(@Body() dto: UpdateProfileDto, @Req() req: any) {
    return this.profilesService.updateProfile(req.user.id, dto);
  }
}
