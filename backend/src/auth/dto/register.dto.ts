import { IsEmail, IsString, MaxLength, MinLength, IsOptional } from 'class-validator';
import { trimLowercaseEmail } from './trim-lowercase-email.decorator';

export class RegisterDto {
  @trimLowercaseEmail
  @IsEmail()
  @MaxLength(320)
  email: string;

  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  @MaxLength(72, { message: 'La contraseña no puede superar 72 caracteres (límite de bcrypt)' })
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}
