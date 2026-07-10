import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

export class ExpenseImportStatusItemDto {
  @IsUUID()
  id!: string;

  @IsBoolean()
  loaded!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  error?: string;
}

export class SyncExpenseImportStatusDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExpenseImportStatusItemDto)
  expenses!: ExpenseImportStatusItemDto[];
}
