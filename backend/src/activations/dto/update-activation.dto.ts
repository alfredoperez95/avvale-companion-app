import { IsString, IsOptional, IsArray, MinLength } from 'class-validator';

export class UpdateActivationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  projectName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  offerCode?: string;

  @IsOptional()
  @IsString()
  hubspotUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  recipientTo?: string;

  @IsOptional()
  @IsString()
  recipientCc?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  subject?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  templateCode?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentUrls?: string[];
}
