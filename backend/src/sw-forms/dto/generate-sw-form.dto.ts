import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export enum SwFormDeploymentType {
  ON_PREMISE = 'ON_PREMISE',
  CLOUD = 'CLOUD',
  IAAS_RESELL = 'IAAS_RESELL',
}

export class GenerateSwFormLineDto {
  @IsString({ message: 'El tipo de SW es obligatorio' })
  @MaxLength(180, { message: 'El tipo de SW es demasiado largo' })
  tipoSw!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El precio de venta debe ser numérico' })
  @Min(0, { message: 'El precio de venta no puede ser negativo' })
  @Max(999_999_999, { message: 'El precio de venta es demasiado alto' })
  precioVenta!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El coste debe ser numérico' })
  @Min(0, { message: 'El coste no puede ser negativo' })
  @Max(999_999_999, { message: 'El coste es demasiado alto' })
  coste!: number;

  @IsString({ message: 'La práctica es obligatoria' })
  @MaxLength(80, { message: 'La práctica es demasiado larga' })
  practica!: string;
}

export class GenerateSwFormDto {
  @IsString({ message: 'El cliente a facturar es obligatorio' })
  @MaxLength(180, { message: 'El cliente a facturar es demasiado largo' })
  clienteFacturar!: string;

  @IsDateString({}, { message: 'La fecha de aceptación no es válida' })
  fechaAceptacion!: string;

  @IsDateString({}, { message: 'La fecha de reconocimiento no es válida' })
  fechaReconocimiento!: string;

  @IsString({ message: 'El código de oferta es obligatorio' })
  @MaxLength(80, { message: 'El código de oferta es demasiado largo' })
  codigoOferta!: string;

  @ValidateIf((dto: { tipo?: SwFormDeploymentType }) => dto.tipo === SwFormDeploymentType.ON_PREMISE)
  @IsString({ message: 'El código de mantenimiento es obligatorio' })
  @MaxLength(80, { message: 'El código de mantenimiento es demasiado largo' })
  codigoMantenimiento?: string;

  @ValidateIf((dto: { tipo?: SwFormDeploymentType }) => dto.tipo === SwFormDeploymentType.ON_PREMISE)
  @IsDateString({}, { message: 'La fecha de inicio del mantenimiento no es válida' })
  fechaInicioMantenimiento?: string;

  @ValidateIf((dto: { tipo?: SwFormDeploymentType }) => dto.tipo === SwFormDeploymentType.ON_PREMISE)
  @IsDateString({}, { message: 'La fecha de fin del mantenimiento no es válida' })
  fechaFinMantenimiento?: string;

  @Type(() => Number)
  @IsInt({ message: 'Los años a reconocer deben ser un número entero' })
  @Min(1, { message: 'Los años a reconocer deben ser como mínimo 1' })
  @Max(10, { message: 'Los años a reconocer no pueden ser mayores que 10' })
  aniosReconocer!: number;

  @IsOptional()
  @IsString({ message: 'Los comentarios deben ser texto' })
  @MaxLength(1000, { message: 'Los comentarios son demasiado largos' })
  comentarios?: string;

  @IsEnum(SwFormDeploymentType, { message: 'El tipo seleccionado no es válido' })
  tipo!: SwFormDeploymentType;

  @IsArray({ message: 'Las líneas deben enviarse como una lista' })
  @ArrayNotEmpty({ message: 'Añade al menos una línea de SW' })
  @ValidateNested({ each: true })
  @Type(() => GenerateSwFormLineDto)
  lineas!: GenerateSwFormLineDto[];
}
