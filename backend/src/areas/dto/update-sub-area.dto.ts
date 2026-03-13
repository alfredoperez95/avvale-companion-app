import { IsString, MinLength, IsOptional } from 'class-validator';

export class UpdateSubAreaDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'El nombre de la subárea no puede estar vacío' })
  name?: string;
}
