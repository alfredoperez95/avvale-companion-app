import { IsString, IsOptional, IsArray, MinLength } from 'class-validator';

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
  hubspotUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  areaIds?: string[];

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentUrls?: string[];
}
