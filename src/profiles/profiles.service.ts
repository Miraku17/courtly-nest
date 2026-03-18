import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfilesService {
  constructor(private supabase: SupabaseService) { }

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

  async getProfile(userId: string) {

    const { data, error } = await this.supabase.client
      .from('profiles')
      .select()
      .eq('id', userId)
      .single();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    const { data: authData, error: authError } = await this.supabase.client.auth.admin.getUserById(userId);

    return { profile: { ...data, email: authData?.user?.email ?? null } };
  }

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided.');
    }

    const ext = file.originalname.split('.').pop();
    const filePath = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await this.supabase.client.storage
      .from('avatars')
      .upload(filePath, file.buffer, { upsert: true, contentType: file.mimetype });

    if (uploadError) {
      throw new InternalServerErrorException(uploadError.message);
    }

    const { data: urlData } = this.supabase.client.storage
      .from('avatars')
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;

    const { error: updateError } = await this.supabase.client
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', userId);

    if (updateError) {
      throw new InternalServerErrorException(updateError.message);
    }

    return { message: 'Avatar uploaded successfully.', avatarUrl: publicUrl };
  }

}
