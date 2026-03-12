import { IsString, IsOptional, IsArray, MinLength } from 'class-validator';

export class CreateActivationDto {
  @IsString()
  @MinLength(1, { message: 'El nombre del proyecto es obligatorio' })
  projectName: string;

  @IsString()
  @MinLength(1, { message: 'El código de oferta es obligatorio' })
  offerCode: string;

  @IsOptional()
  @IsString()
  hubspotUrl?: string;

  @IsString()
  @MinLength(1, { message: 'El destinatario es obligatorio' })
  recipientTo: string;

  @IsOptional()
  @IsString()
  recipientCc?: string;

  @IsString()
  @MinLength(1, { message: 'El asunto es obligatorio' })
  subject: string;

  @IsString()
  @MinLength(1, { message: 'El código de plantilla es obligatorio' })
  templateCode: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentUrls?: string[];
}
