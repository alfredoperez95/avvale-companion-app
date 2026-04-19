import type { ConfigService } from '@nestjs/config';
import type { AnthropicModelChoice } from '../yubiq/approve-seal-filler/anthropic-client.service';

export function getMeddpiccModel(config: ConfigService): AnthropicModelChoice {
  const raw = config.get<string>('MEDDPICC_MODEL')?.trim().toLowerCase();
  if (raw === 'sonnet' || raw === 'opus' || raw === 'haiku') return raw;
  return 'sonnet';
}
