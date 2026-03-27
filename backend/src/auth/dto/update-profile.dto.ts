import { IsString, IsOptional, MaxLength, IsIn, MinLength } from 'class-validator';

export const APPEARANCE_VALUES = ['microsoft', 'fiori'] as const;
export type AppearanceValue = (typeof APPEARANCE_VALUES)[number];

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
}
