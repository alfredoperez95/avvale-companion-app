import { IsString, MinLength, IsOptional } from 'class-validator';

export class UpdateAreaDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'El nombre del área no puede estar vacío' })
  name?: string;
}
