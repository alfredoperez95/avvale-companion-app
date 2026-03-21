import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class MakeCallbackDto {
  @IsString()
  @IsNotEmpty()
  secret: string;

  @IsUUID()
  activationId: string;

  /** Opcional: trazabilidad; si se envía, debe coincidir con el número en BD. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  activationNumber?: number;

  /** Opcional: trazabilidad (p. ej. ACT-000124); si se envía, debe coincidir con el derivado del número en BD. */
  @IsOptional()
  @IsString()
  activationCode?: string;

  @IsIn(['sent', 'error'])
  status: 'sent' | 'error';

  @IsOptional()
  @IsString()
  errorMessage?: string;
}
