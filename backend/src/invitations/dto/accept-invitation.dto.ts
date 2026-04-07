import { IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { UserIndustry, UserPosition } from '@prisma/client';

export class AcceptInvitationDto {
  @IsString()
  @MinLength(1, { message: 'Token no válido' })
  token: string;

  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;

  /** Obligatorio en el alta si la invitación no fijó puesto (el usuario debe elegir). */
  @IsOptional()
  @IsEnum(UserPosition, { message: 'Puesto no válido' })
  position?: UserPosition;

  @IsOptional()
  @IsEnum(UserIndustry, { message: 'Industria no válida' })
  industry?: UserIndustry;
}
