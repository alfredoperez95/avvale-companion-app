import { IsOptional, IsString } from 'class-validator';

export class UpdateEmailSignatureDto {
  @IsOptional()
  @IsString()
  content?: string;
}
