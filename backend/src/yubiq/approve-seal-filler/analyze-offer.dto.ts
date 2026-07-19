import { IsIn, IsOptional } from 'class-validator';

export class AnalyzeOfferDto {
  @IsOptional()
  @IsIn(['haiku', 'sonnet', 'opus'])
  model?: 'haiku' | 'sonnet' | 'opus';
}
