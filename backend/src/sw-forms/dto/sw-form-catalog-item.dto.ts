import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateSwFormCatalogItemDto {
  @IsString({ message: 'El tipo de SW es obligatorio' })
  @MaxLength(180, { message: 'El tipo de SW es demasiado largo' })
  tipoSw!: string;

  @IsString({ message: 'La práctica es obligatoria' })
  @MaxLength(80, { message: 'La práctica es demasiado larga' })
  practica!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El orden debe ser entero' })
  @Min(0)
  @Max(100_000)
  sortOrder?: number;
}

export class UpdateSwFormCatalogItemDto {
  @IsOptional()
  @IsString({ message: 'El tipo de SW es obligatorio' })
  @MaxLength(180, { message: 'El tipo de SW es demasiado largo' })
  tipoSw?: string;

  @IsOptional()
  @IsString({ message: 'La práctica es obligatoria' })
  @MaxLength(80, { message: 'La práctica es demasiado larga' })
  practica?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El orden debe ser entero' })
  @Min(0)
  @Max(100_000)
  sortOrder?: number;
}
