import { IsString, MinLength, IsOptional, IsEnum, IsEmail, IsBoolean } from 'class-validator';
import { UserRole } from '@prisma/client';

export class UpdateUserByAdminDto {
  @IsOptional()
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  email?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsEnum(UserRole, { message: 'El rol debe ser USER o ADMIN' })
  role?: UserRole;

  @IsOptional()
  @IsBoolean({ message: 'El estado debe ser true o false' })
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  newPassword?: string;
}
