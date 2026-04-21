import { IsString, MaxLength, MinLength } from 'class-validator';

export class FetchElevenlabsConversationDto {
  @IsString()
  @MinLength(8)
  @MaxLength(220)
  conversationId!: string;
}
