import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfilesService {
  constructor(private supabase: SupabaseService) {}

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const updateData: Record<string, string> = {};

    if (dto.firstName) updateData.first_name = dto.firstName;
    if (dto.lastName) updateData.last_name = dto.lastName;
    if (dto.phone) updateData.phone = dto.phone;

    const { data, error } = await this.supabase.client
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return { message: 'Profile updated successfully.', profile: data };
  }
}
