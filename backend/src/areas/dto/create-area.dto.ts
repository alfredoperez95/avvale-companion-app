import { IsString, MinLength, IsOptional, IsEmail } from 'class-validator';

export class CreateAreaDto {
  @IsString()
  @MinLength(1, { message: 'El nombre del área es obligatorio' })
  name: string;

  @IsOptional()
  @IsString()
  directorName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El email del director no es válido' })
  directorEmail?: string;
}
