import { Body, Controller, Post, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignUpDto } from './dto/signup.dto';
import { SignInDto } from './dto/signin.dto';
import * as express from 'express';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  @Post('signup')
  signUp(@Body() dto: SignUpDto) {
    return this.authService.signUp(dto);
  }

  @Post('signout')
  async signout(@Res() res: express.Response) {
    await this.authService.signOut();

    res.clearCookie('access_token', { path: '/' });

    return res.json({ message: 'Signed out successfully.' });

  }

  @Post('signin')
  async signin(@Body() dto: SignInDto, @Res() res: express.Response) {
    const data = await this.authService.signIn(dto);

    res.cookie('access_token', data.session.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 3600 * 1000,
    });

    return res.json({ user: data.user });
  }
}
