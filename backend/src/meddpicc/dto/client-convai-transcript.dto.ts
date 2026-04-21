import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Transcripción / resumen enviados desde el cliente cuando el webhook de ElevenLabs no llega o falla. */
export class ClientConvaiTranscriptDto {
  @IsString()
  @MaxLength(500_000)
  transcriptMarkdown!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  summary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  conversationId?: string;
}
