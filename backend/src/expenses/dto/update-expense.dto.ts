import { IsBoolean, IsIn, IsISO8601, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { EXPENSE_CATEGORIES } from '../expense-categories';

export class UpdateExpenseDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El importe debe ser numérico' })
  @Min(0, { message: 'El importe debe ser positivo' })
  amount!: number;

  @IsString()
  @IsNotEmpty()
  @IsIn(EXPENSE_CATEGORIES, { message: 'Tipo de gasto no válido' })
  type!: string;

  @IsString()
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  @MaxLength(1000, { message: 'La descripción no puede superar 1000 caracteres' })
  description!: string;

  @IsString()
  @IsISO8601({}, { message: 'La fecha debe tener formato ISO' })
  date!: string;

  @IsOptional()
  @IsBoolean({ message: 'Paid by company debe ser verdadero o falso' })
  paidByCompany?: boolean;
}
