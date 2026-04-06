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

  @IsOptional()
  @IsString()
  @MaxLength(255)
  mimeType?: string;

  /** Base64 del fichero (Make puede mapear el binario). */
  @IsString()
  @IsNotEmpty()
  contentBase64!: string;
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
