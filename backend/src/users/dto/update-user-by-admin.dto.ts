import { IsString, MinLength, IsOptional, IsEnum, IsEmail, IsBoolean } from 'class-validator';
import { UserIndustry, UserPosition, UserRole } from '@prisma/client';

export class UpdateUserByAdminDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser texto' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'El apellido debe ser texto' })
  lastName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  email?: string;

  @IsOptional()
  @IsEnum(UserPosition, { message: 'Puesto no válido' })
  position?: UserPosition | null;

  @IsOptional()
  @IsEnum(UserIndustry, { message: 'Industria no válida' })
  industry?: UserIndustry | null;

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
