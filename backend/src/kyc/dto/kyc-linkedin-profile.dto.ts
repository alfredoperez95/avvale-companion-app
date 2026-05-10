import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Cuerpo POST /kyc/linkedin-profile (extensión Chrome).
 * Campos explícitos para ValidationPipe global forbidNonWhitelisted.
 */
export class KycLinkedInProfileDto {
  @IsString()
  @IsIn(['linkedin', 'extension_linkedin'])
  source!: string;

  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  clientId!: number;

  @IsString()
  name!: string;

  @IsString()
  role!: string;

  @IsString()
  level!: string;

  @IsOptional()
  @IsString()
  profileUrl?: string;

  @IsOptional()
  @IsString()
  linkedInUrl?: string;

  @IsOptional()
  @IsString()
  headline?: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  rawText?: string;

  @IsOptional()
  @IsString()
  capturedAt?: string;
}
