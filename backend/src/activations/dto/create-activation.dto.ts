import { IsString, IsOptional, IsArray, MinLength, Allow, IsIn } from 'class-validator';

export class CreateActivationDto {
  @IsString()
  @MinLength(1, { message: 'El nombre del proyecto es obligatorio' })
  projectName: string;

  @Allow()
  @IsOptional()
  @IsString()
  client?: string;

  @IsString()
  @MinLength(1, { message: 'El código de oferta es obligatorio' })
  offerCode: string;

  @IsString()
  @MinLength(1, { message: 'El importe del proyecto es obligatorio' })
  projectAmount: string;

  @IsString()
  @IsIn(['CONSULTORIA', 'SW'], { message: 'El tipo de oportunidad es obligatorio' })
  projectType: 'CONSULTORIA' | 'SW';

  @IsOptional()
  @IsString()
  hubspotUrl?: string;

  @IsOptional()
  @IsString()
  @IsIn(['SI', 'NO'], { message: 'PFE debe ser Sí o No' })
  pfe?: 'SI' | 'NO';

  @IsOptional()
  @IsString()
  @IsIn(['SI', 'NO', 'PENDIENTE'], { message: 'Pedido debe ser Sí, No o Pendiente' })
  pedido?: 'SI' | 'NO' | 'PENDIENTE';

  @IsOptional()
  @IsString()
  yubiqAsUrl?: string;

  @IsOptional()
  @IsString()
  yubiqAsId?: string;

  @IsArray()
  @IsString({ each: true })
  areaIds: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subAreaIds?: string[];

  @Allow()
  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  recipientCc?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentUrls?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentNames?: string[];

  @IsOptional()
  @IsString()
  projectJpContactId?: string | null;

  @IsOptional()
  @IsString()
  projectJpAutoSubAreaContactId?: string | null;
}
