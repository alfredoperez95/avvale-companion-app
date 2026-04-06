import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateRfqAnalysisDto {
  @IsString()
  @MinLength(1, { message: 'El título es obligatorio' })
  @MaxLength(512)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  manualContext?: string;
}
