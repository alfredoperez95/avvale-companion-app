import { IsString, MinLength, IsEmail } from 'class-validator';

export class CreateAreaContactDto {
  @IsString()
  @MinLength(1, { message: 'El nombre del contacto es obligatorio' })
  name: string;

  @IsEmail({}, { message: 'El email no es válido' })
  email: string;
}
