import { IsString, IsOptional, IsArray, MinLength, IsIn } from 'class-validator';

export class UpdateActivationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  projectName?: string;

  @IsOptional()
  @IsString()
  client?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  offerCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'El importe del proyecto es obligatorio' })
  projectAmount?: string;

  @IsOptional()
  @IsString()
  @IsIn(['CONSULTORIA', 'SW'], { message: 'El tipo de oportunidad es obligatorio' })
  projectType?: 'CONSULTORIA' | 'SW';

  @IsOptional()
  @IsString()
  hubspotUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  areaIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subAreaIds?: string[];

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
}
