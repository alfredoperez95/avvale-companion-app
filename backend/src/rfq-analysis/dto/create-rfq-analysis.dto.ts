import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateRfqAnalysisDto {
  @IsString()
  @MinLength(1, { message: 'El título es obligatorio' })
  @MaxLength(512)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  manualContext?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Selecciona un cliente con perfil KYC' })
  kycCompanyId!: number;
}
