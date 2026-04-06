import type { ConfigService } from '@nestjs/config';
import type { AnthropicModelChoice } from '../yubiq/approve-seal-filler/anthropic-client.service';

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = raw != null ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getRfqMaxAttachments(config: ConfigService): number {
  return parsePositiveInt(config.get<string>('RFQ_MAX_ATTACHMENTS_PER_ANALYSIS'), 10);
}

export function getRfqMaxFileBytes(config: ConfigService): number {
  return parsePositiveInt(config.get<string>('RFQ_MAX_FILE_BYTES'), 20 * 1024 * 1024);
}

export function getRfqMaxTotalBytes(config: ConfigService): number {
  return parsePositiveInt(config.get<string>('RFQ_MAX_TOTAL_BYTES_PER_ANALYSIS'), 50 * 1024 * 1024);
}

export function getRfqContextMaxChars(config: ConfigService): number {
  return parsePositiveInt(config.get<string>('RFQ_CONTEXT_MAX_CHARS'), 120_000);
}

export function getRfqSynthesisModel(config: ConfigService): AnthropicModelChoice {
  const raw = config.get<string>('RFQ_SYNTHESIS_MODEL')?.trim().toLowerCase();
  if (raw === 'sonnet' || raw === 'opus' || raw === 'haiku') return raw;
  return 'haiku';
}

/** Segunda pasada de síntesis (p. ej. Sonnet) si hay fuentes no-PDF o falla el JSON en la primera. */
export function getRfqSynthesisEscalationModel(config: ConfigService): AnthropicModelChoice {
  const raw = config.get<string>('RFQ_SYNTHESIS_ESCALATION_MODEL')?.trim().toLowerCase();
  if (raw === 'sonnet' || raw === 'opus' || raw === 'haiku') return raw;
  return 'sonnet';
}

export function getRfqChatModel(config: ConfigService): AnthropicModelChoice {
  const raw = config.get<string>('RFQ_CHAT_MODEL')?.trim().toLowerCase();
  if (raw === 'sonnet' || raw === 'opus' || raw === 'haiku') return raw;
  return getRfqSynthesisModel(config);
}
