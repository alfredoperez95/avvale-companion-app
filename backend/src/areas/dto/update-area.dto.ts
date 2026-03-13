import { IsString, MinLength, IsOptional, IsEmail } from 'class-validator';

export class UpdateAreaDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'El nombre del área no puede estar vacío' })
  name?: string;

  @IsOptional()
  @IsString()
  directorName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El email del director no es válido' })
  directorEmail?: string;
}
