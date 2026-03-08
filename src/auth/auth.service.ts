import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SignUpDto } from './dto/signup.dto';

@Injectable()
export class AuthService {
  constructor(private supabase: SupabaseService) {}

  async signUp(dto: SignUpDto) {
    // 1. Create the user in Supabase Auth
    const { data, error } = await this.supabase.client.auth.admin.createUser({
      email: dto.email,
      password: dto.password,
      email_confirm: false, // sends confirmation email; set true to skip in dev
      user_metadata: {
        first_name: dto.firstName,
        last_name: dto.lastName,
      },
    });

    if (error) {
      if (error.message.includes('already registered')) {
        throw new BadRequestException('Email is already in use.');
      }
      throw new InternalServerErrorException(error.message);
    }

    const userId = data.user.id;

    // 2. Update the auto-created profile row (created by DB trigger) with role and name
    const { error: profileError } = await this.supabase.client
      .from('profiles')
      .update({
        role: dto.role,
        first_name: dto.firstName,
        last_name: dto.lastName,
      })
      .eq('id', userId);

    if (profileError) {
      throw new InternalServerErrorException(profileError.message);
    }

    return {
      message: 'Account created. Please check your email to confirm your account.',
      user: {
        id: userId,
        email: data.user.email,
        role: dto.role,
      },
    };
  }
}
