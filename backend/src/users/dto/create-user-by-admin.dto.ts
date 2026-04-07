import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { UserIndustry, UserPosition, UserRole } from '@prisma/client';

export class CreateUserByAdminDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;

  @IsString()
  @MinLength(1, { message: 'El nombre es obligatorio' })
  name: string;

  @IsString()
  @MinLength(1, { message: 'Los apellidos son obligatorios' })
  lastName: string;

  @IsEnum(UserPosition, { message: 'Selecciona un puesto válido' })
  position: UserPosition;

  @IsOptional()
  @IsEnum(UserIndustry, { message: 'Industria no válida' })
  industry?: UserIndustry;

  @IsOptional()
  @IsEnum(UserRole, { message: 'El rol debe ser USER o ADMIN' })
  role?: UserRole;
}
