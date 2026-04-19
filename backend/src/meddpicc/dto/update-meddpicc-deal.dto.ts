import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMeddpiccDealDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  company?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  value?: string;

  @IsOptional()
  @IsString()
  context?: string | null;

  @IsOptional()
  @IsObject()
  scores?: Record<string, number>;

  @IsOptional()
  @IsObject()
  answers?: Record<string, string>;

  @IsOptional()
  @IsObject()
  notes?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  status?: string;

  /** Nota opcional al registrar cambios de score en historial. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  scoreChangeNote?: string;
}
