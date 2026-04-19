import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AnalyzeMeddpiccDealDto {
  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  additionalContext?: string;
}
