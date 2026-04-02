import { IsString, MinLength } from 'class-validator';

export class SetAnthropicApiKeyDto {
  @IsString()
  @MinLength(10)
  apiKey!: string;
}

export type AnthropicCredentialStatusResponse = {
  configured: boolean;
  masked: string | null;
};

export type AnthropicTestConnectionResponse = {
  ok: boolean;
  message: string;
};

