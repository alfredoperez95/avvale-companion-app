import { IsIn, IsObject, IsOptional } from 'class-validator';

export class TranslateExtractionDto {
  @IsObject()
  extraction!: Record<string, unknown>;

  @IsOptional()
  @IsIn(['haiku', 'sonnet', 'opus'])
  model?: string;
}
