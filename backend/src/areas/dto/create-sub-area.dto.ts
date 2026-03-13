import { IsString, MinLength } from 'class-validator';

export class CreateSubAreaDto {
  @IsString()
  @MinLength(1, { message: 'El nombre de la subárea es obligatorio' })
  name: string;
}
