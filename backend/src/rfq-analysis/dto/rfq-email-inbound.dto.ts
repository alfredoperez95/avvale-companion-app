import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class RfqEmailAttachmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  fileName!: string;

  /** Base64 del fichero (Make puede mapear el binario). */
  @IsString()
  @IsNotEmpty()
  contentBase64!: string;

  /**
   * MIME enviado explícitamente (p. ej. desde Make). Tiene prioridad sobre {@link mimeType}.
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  contentType?: string;

  /**
   * @deprecated Preferir {@link contentType}; se mantiene para payloads antiguos de Make.
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  mimeType?: string;
}

export class RfqEmailInboundDto {
  @IsString()
  @IsNotEmpty()
  secret!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(320)
  fromEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(998)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500_000)
  bodyPlain?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500_000)
  threadContext?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RfqEmailAttachmentDto)
  @ArrayMaxSize(50)
  attachments?: RfqEmailAttachmentDto[];
}
