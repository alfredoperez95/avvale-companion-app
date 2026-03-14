import { IsString, MinLength } from 'class-validator';

export class CreateEmailTemplateDto {
  @IsString()
  @MinLength(1, { message: 'El nombre es obligatorio' })
  name: string;

  @IsString()
  content: string;
}
