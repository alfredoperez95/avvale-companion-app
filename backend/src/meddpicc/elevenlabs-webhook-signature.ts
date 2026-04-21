import { createHmac, timingSafeEqual } from 'crypto';

/** Tolerancia alineada con el SDK de ElevenLabs (replay). */
const TIMESTAMP_TOLERANCE_SEC = 30 * 60;

export type ElevenlabsWebhookVerifyResult =
  | { ok: true; event: Record<string, unknown> }
  | { ok: false; message: string };

function parseElevenlabsSignatureHeader(header: string | undefined): { t: string; v0: string } | null {
  if (!header || typeof header !== 'string') return null;
  let t: string | undefined;
  let v0: string | undefined;
  for (const part of header.split(',')) {
    const p = part.trim();
    const eq = p.indexOf('=');
    if (eq < 0) continue;
    const key = p.slice(0, eq).trim();
    const val = p.slice(eq + 1).trim();
    if (key === 't') t = val;
    if (key === 'v0') v0 = val;
  }
  if (!t || !v0) return null;
  return { t, v0 };
}

/**
 * Verifica `elevenlabs-signature` (t=…,v0=…) con HMAC-SHA256 de `{t}.{rawBody}` y parsea el JSON.
 */
export function verifyElevenlabsWebhookPayload(
  rawBodyUtf8: string,
  sigHeader: string | undefined,
  secret: string,
): ElevenlabsWebhookVerifyResult {
  const parsed = parseElevenlabsSignatureHeader(sigHeader);
  if (!parsed) return { ok: false, message: 'Cabecera elevenlabs-signature inválida o ausente' };

  const now = Math.floor(Date.now() / 1000);
  const ts = Number.parseInt(parsed.t, 10);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > TIMESTAMP_TOLERANCE_SEC) {
    return { ok: false, message: 'Marca de tiempo de firma fuera de tolerancia' };
  }

  const signedPayload = `${parsed.t}.${rawBodyUtf8}`;
  const expectedHex = createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');

  let expectedBuf: Buffer;
  let receivedBuf: Buffer;
  try {
    expectedBuf = Buffer.from(expectedHex, 'hex');
    receivedBuf = Buffer.from(parsed.v0, 'hex');
  } catch {
    return { ok: false, message: 'Firma no parseable' };
  }
  if (expectedBuf.length !== receivedBuf.length || expectedBuf.length === 0) {
    return { ok: false, message: 'Firma incorrecta' };
  }
  if (!timingSafeEqual(expectedBuf, receivedBuf)) {
    return { ok: false, message: 'Firma incorrecta' };
  }

  let event: unknown;
  try {
    event = JSON.parse(rawBodyUtf8) as unknown;
  } catch {
    return { ok: false, message: 'Cuerpo JSON inválido' };
  }
  if (event == null || typeof event !== 'object' || Array.isArray(event)) {
    return { ok: false, message: 'Payload JSON inválido' };
  }
  return { ok: true, event: event as Record<string, unknown> };
}
