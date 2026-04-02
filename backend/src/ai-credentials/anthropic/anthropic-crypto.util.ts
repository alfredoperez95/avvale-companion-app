import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

export type EncryptedSecret = {
  ciphertextB64: string;
  ivB64: string;
  tagB64: string;
};

function parseMasterKey(raw: string): Buffer {
  const trimmed = raw.trim();
  // hex (64 chars) → 32 bytes
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }
  // base64 → 32 bytes
  try {
    const b = Buffer.from(trimmed, 'base64');
    if (b.length === 32) return b;
  } catch {
    // ignore
  }
  // raw utf8 (must be 32 bytes)
  const utf8 = Buffer.from(trimmed, 'utf8');
  if (utf8.length === 32) return utf8;

  throw new ServiceUnavailableException(
    'ANTHROPIC_API_KEY_MASTER_KEY inválida (debe ser 32 bytes en hex/base64/raw).',
  );
}

export function getAnthropicMasterKey(config: ConfigService): Buffer {
  const raw = config.get<string>('ANTHROPIC_API_KEY_MASTER_KEY') ?? '';
  if (!raw.trim()) {
    throw new ServiceUnavailableException(
      'ANTHROPIC_API_KEY_MASTER_KEY no está configurada.',
    );
  }
  return parseMasterKey(raw);
}

export function encryptSecretAes256Gcm(plain: string, masterKey: Buffer): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', masterKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertextB64: ciphertext.toString('base64'),
    ivB64: iv.toString('base64'),
    tagB64: tag.toString('base64'),
  };
}

export function decryptSecretAes256Gcm(enc: EncryptedSecret, masterKey: Buffer): string {
  const iv = Buffer.from(enc.ivB64, 'base64');
  const ciphertext = Buffer.from(enc.ciphertextB64, 'base64');
  const tag = Buffer.from(enc.tagB64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', masterKey, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString('utf8');
}

