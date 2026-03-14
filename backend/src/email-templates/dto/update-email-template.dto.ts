import { IsString, MinLength, IsOptional } from 'class-validator';

export class UpdateEmailTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'El nombre es obligatorio' })
  name?: string;

  @IsOptional()
  @IsString()
  content?: string;
}
