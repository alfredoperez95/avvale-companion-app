import { IsString, MinLength, IsEmail, IsOptional } from 'class-validator';

export class UpdateSubAreaContactDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'El nombre del contacto no puede estar vacío' })
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El email no es válido' })
  email?: string;
}
