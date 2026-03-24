import { IsString, MinLength, IsEmail, IsOptional, IsBoolean } from 'class-validator';

export class CreateSubAreaContactDto {
  @IsString()
  @MinLength(1, { message: 'El nombre del contacto es obligatorio' })
  name: string;

  @IsEmail({}, { message: 'El email no es válido' })
  email: string;

  @IsOptional()
  @IsBoolean()
  isProjectJp?: boolean;
}
