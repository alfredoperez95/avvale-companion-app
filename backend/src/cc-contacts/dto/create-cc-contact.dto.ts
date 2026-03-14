import { IsString, MinLength, IsEmail } from 'class-validator';

export class CreateCcContactDto {
  @IsString()
  @MinLength(1, { message: 'El nombre es obligatorio' })
  name: string;

  @IsEmail({}, { message: 'El email no es válido' })
  email: string;
}
