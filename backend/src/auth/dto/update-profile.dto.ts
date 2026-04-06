import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const APPEARANCE_VALUES = ['microsoft', 'fiori'] as const;
export type AppearanceValue = (typeof APPEARANCE_VALUES)[number];

/** IDs de mosaicos del App Launcher (permutación completa). */
export const LAUNCHER_TILE_IDS = ['activations', 'pipeline', 'yubiq', 'rfqAnalysis'] as const;
export type LauncherTileId = (typeof LAUNCHER_TILE_IDS)[number];

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'El nombre es obligatorio' })
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Los apellidos son obligatorios' })
  @MaxLength(120)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'El puesto es obligatorio' })
  @MaxLength(120)
  position?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @IsIn(APPEARANCE_VALUES, { message: 'Apariencia debe ser "microsoft" o "fiori"' })
  appearance?: AppearanceValue;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @ArrayUnique()
  @IsString({ each: true })
  @IsIn(LAUNCHER_TILE_IDS, {
    each: true,
    message: 'Cada id de mosaico debe ser activations, pipeline, yubiq o rfqAnalysis',
  })
  launcherTileOrder?: LauncherTileId[];
}
