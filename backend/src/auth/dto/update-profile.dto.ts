import { IsString, IsOptional, MaxLength, IsIn } from 'class-validator';

export const APPEARANCE_VALUES = ['microsoft', 'fiori'] as const;
export type AppearanceValue = (typeof APPEARANCE_VALUES)[number];

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  position?: string;

  @IsOptional()
  @IsString()
  @IsIn(APPEARANCE_VALUES, { message: 'Apariencia debe ser "microsoft" o "fiori"' })
  appearance?: AppearanceValue;
}
