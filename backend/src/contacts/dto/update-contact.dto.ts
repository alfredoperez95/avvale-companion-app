import { IsString, MinLength, IsEmail, IsOptional } from 'class-validator';

export class UpdateContactDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'El nombre es obligatorio' })
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El email no es válido' })
  email?: string;
}
