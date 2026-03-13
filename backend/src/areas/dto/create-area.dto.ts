import { IsString, MinLength } from 'class-validator';

export class CreateAreaDto {
  @IsString()
  @MinLength(1, { message: 'El nombre del área es obligatorio' })
  name: string;
}
