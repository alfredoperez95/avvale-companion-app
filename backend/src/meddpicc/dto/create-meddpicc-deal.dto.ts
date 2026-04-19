import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateMeddpiccDealDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  company?: string;

  /** Etiqueta comercial libre (opcional). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  ownerLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  value?: string;

  @IsOptional()
  @IsString()
  context?: string;

  /** Solo ADMIN: crear el deal en nombre de otro usuario. */
  @IsOptional()
  @IsUUID()
  forUserId?: string;
}
