import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { UserIndustry, UserPosition, UserRole } from '@prisma/client';

export class InviteUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1, { message: 'El nombre es obligatorio' })
  name: string;

  @IsString()
  @MinLength(1, { message: 'Los apellidos son obligatorios' })
  lastName: string;

  @IsOptional()
  @IsEnum(UserPosition, { message: 'Puesto no válido' })
  position?: UserPosition;

  @IsOptional()
  @IsEnum(UserIndustry, { message: 'Industria no válida' })
  industry?: UserIndustry;

  @IsOptional()
  @IsEnum(UserRole, { message: 'El rol debe ser USER o ADMIN' })
  role?: UserRole;
}
