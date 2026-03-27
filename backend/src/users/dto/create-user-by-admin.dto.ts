import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { UserRole } from '@prisma/client';

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

  @IsString()
  @MinLength(1, { message: 'El puesto es obligatorio' })
  position: string;

  @IsOptional()
  @IsEnum(UserRole, { message: 'El rol debe ser USER o ADMIN' })
  role?: UserRole;
}
