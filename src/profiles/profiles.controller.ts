import { Body, Controller, Patch, Req, UseGuards, Get, Post, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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


  @Get('me')
  @UseGuards(AuthGuard)
  getProfile(@Req() req: any) {
    return this.profilesService.getProfile(req.user.id);
  }


  @Post('me/avatar')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  uploadAvatar(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    return this.profilesService.uploadAvatar(req.user.id, file);
  }

}
