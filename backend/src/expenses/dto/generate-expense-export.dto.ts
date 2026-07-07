import { ArrayNotEmpty, IsArray, IsInt, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GenerateExpenseExportDto {
  @Type(() => Number)
  @IsInt({ message: 'El año debe ser un número entero' })
  @Min(2000, { message: 'El año no es válido' })
  @Max(2100, { message: 'El año no es válido' })
  year!: number;

  @Type(() => Number)
  @IsInt({ message: 'El mes debe ser un número entero' })
  @Min(1, { message: 'El mes debe estar entre 1 y 12' })
  @Max(12, { message: 'El mes debe estar entre 1 y 12' })
  month!: number;

  @IsArray({ message: 'Los gastos a exportar deben enviarse como una lista' })
  @ArrayNotEmpty({ message: 'Selecciona al menos un gasto para exportar' })
  @IsUUID('4', { each: true, message: 'Uno de los gastos no tiene un identificador válido' })
  expenseIds!: string[];
}
