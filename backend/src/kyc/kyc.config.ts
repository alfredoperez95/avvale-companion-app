import type { ConfigService } from '@nestjs/config';
import type { AnthropicModelChoice } from '../yubiq/approve-seal-filler/anthropic-client.service';

/** Modelo de chat KYC (Anthropic). Por defecto Sonnet para investigación/entrevista. */
export function getKycChatModel(config: ConfigService): AnthropicModelChoice {
  const raw = config.get<string>('KYC_CHAT_MODEL')?.trim().toLowerCase();
  if (raw === 'sonnet' || raw === 'opus' || raw === 'haiku') return raw;
  return 'sonnet';
}

/** Modelo para redactar el resumen ejecutivo desde ficha + perfil (por defecto Haiku, más económico). */
export function getKycSummaryModel(config: ConfigService): AnthropicModelChoice {
  const raw = config.get<string>('KYC_SUMMARY_MODEL')?.trim().toLowerCase();
  if (raw === 'sonnet' || raw === 'opus' || raw === 'haiku') return raw;
  return 'haiku';
}
