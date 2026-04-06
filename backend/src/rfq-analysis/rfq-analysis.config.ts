import type { ConfigService } from '@nestjs/config';
import type { AnthropicModelChoice } from '../yubiq/approve-seal-filler/anthropic-client.service';

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = raw != null ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getRfqMaxAttachments(config: ConfigService): number {
  return parsePositiveInt(config.get<string>('RFQ_MAX_ATTACHMENTS_PER_ANALYSIS'), 10);
}

/** Default alineado con límite típico de body HTTP para webhooks con un adjunto grande en base64. */
export const RFQ_DEFAULT_MAX_FILE_BYTES = 50 * 1024 * 1024;

export function getRfqMaxFileBytes(config: ConfigService): number {
  return parsePositiveInt(config.get<string>('RFQ_MAX_FILE_BYTES'), RFQ_DEFAULT_MAX_FILE_BYTES);
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

/**
 * URL pública del frontend (enlaces en correos). Preferir APP_PUBLIC_URL en producción.
 * Si solo existe MAGIC_LINK_BASE_URL (…/login/magic), se usa el origen sin ese path.
 */
export function getAppPublicUrl(config: ConfigService): string {
  const explicit = config.get<string>('APP_PUBLIC_URL')?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const magic = config.get<string>('MAGIC_LINK_BASE_URL')?.trim();
  if (magic) {
    try {
      const u = new URL(magic);
      const path = u.pathname.replace(/\/login\/magic\/?$/i, '').replace(/\/$/, '');
      return `${u.origin}${path}`;
    } catch {
      const stripped = magic.replace(/\/login\/magic\/?$/i, '').replace(/\/$/, '');
      if (stripped) return stripped;
    }
  }
  return 'http://localhost:3000';
}
