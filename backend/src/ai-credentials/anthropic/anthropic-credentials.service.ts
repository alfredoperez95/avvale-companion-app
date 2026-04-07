import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  decryptSecretAes256Gcm,
  encryptSecretAes256Gcm,
  getAnthropicMasterKey,
} from './anthropic-crypto.util';

function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (!trimmed) return '****';
  const last4 = trimmed.slice(-4);
  const prefix = trimmed.startsWith('sk-ant-') ? 'sk-ant-' : '';
  return `${prefix}****${last4}`;
}

@Injectable()
export class AnthropicCredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getStatus(userId: string): Promise<{ configured: boolean; masked: string | null }> {
    const row = await this.prisma.userAnthropicCredential.findUnique({
      where: { userId },
      select: { apiKeyCiphertext: true, apiKeyIv: true, apiKeyTag: true },
    });
    if (!row) return { configured: false, masked: null };
    try {
      const masterKey = getAnthropicMasterKey(this.config);
      const apiKey = decryptSecretAes256Gcm(
        { ciphertextB64: row.apiKeyCiphertext, ivB64: row.apiKeyIv, tagB64: row.apiKeyTag },
        masterKey,
      );
      return { configured: Boolean(apiKey.trim()), masked: apiKey.trim() ? maskApiKey(apiKey) : null };
    } catch {
      // Si la master key cambió o hay datos corruptos, no exponer detalles.
      return { configured: true, masked: '****' };
    }
  }

  async setApiKey(userId: string, apiKeyRaw: string): Promise<{ ok: true }> {
    const apiKey = (apiKeyRaw ?? '').trim();
    if (!apiKey) throw new BadRequestException('API key vacía');
    const masterKey = getAnthropicMasterKey(this.config);
    const enc = encryptSecretAes256Gcm(apiKey, masterKey);
    await this.prisma.userAnthropicCredential.upsert({
      where: { userId },
      update: {
        apiKeyCiphertext: enc.ciphertextB64,
        apiKeyIv: enc.ivB64,
        apiKeyTag: enc.tagB64,
      },
      create: {
        userId,
        apiKeyCiphertext: enc.ciphertextB64,
        apiKeyIv: enc.ivB64,
        apiKeyTag: enc.tagB64,
      },
    });
    return { ok: true };
  }

  /** Elimina la clave Anthropic del usuario (si existía). */
  async removeApiKey(userId: string): Promise<{ ok: true }> {
    await this.prisma.userAnthropicCredential.deleteMany({ where: { userId } });
    return { ok: true };
  }

  async getApiKeyPlainOrThrow(userId: string): Promise<string> {
    const row = await this.prisma.userAnthropicCredential.findUnique({
      where: { userId },
      select: { apiKeyCiphertext: true, apiKeyIv: true, apiKeyTag: true },
    });
    if (!row) throw new NotFoundException('No hay API key Anthropic configurada');
    const masterKey = getAnthropicMasterKey(this.config);
    const apiKey = decryptSecretAes256Gcm(
      { ciphertextB64: row.apiKeyCiphertext, ivB64: row.apiKeyIv, tagB64: row.apiKeyTag },
      masterKey,
    );
    if (!apiKey.trim()) throw new NotFoundException('No hay API key Anthropic configurada');
    return apiKey.trim();
  }

  async testConnection(userId: string): Promise<{ ok: boolean; message: string }> {
    const apiKey = await this.getApiKeyPlainOrThrow(userId);
    try {
      let model = 'claude-3-haiku-20240307';
      try {
        const mres = await fetch('https://api.anthropic.com/v1/models?limit=200', {
          method: 'GET',
          headers: {
            'anthropic-version': '2023-06-01',
            'x-api-key': apiKey,
          },
        });
        if (mres.ok) {
          const data = (await mres.json()) as { data?: { id?: string }[] };
          const ids = (data.data ?? []).map((m) => String(m.id ?? '')).filter(Boolean);
          const found = ids.find((id) => id.toLowerCase().includes('haiku'));
          if (found) model = found;
        }
      } catch {
        // keep fallback model
      }
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const snippet = text.length > 200 ? `${text.slice(0, 200)}…` : text;
        return { ok: false, message: `Anthropic respondió ${res.status}. ${snippet}`.trim() };
      }
      return { ok: true, message: 'Conexión OK' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, message: `Error de red: ${msg}` };
    }
  }
}

