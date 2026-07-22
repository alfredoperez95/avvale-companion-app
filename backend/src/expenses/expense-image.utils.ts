import { fork } from 'child_process';
import { randomUUID } from 'crypto';
import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { resolveIsolatedWorkerPath } from '../workers/isolated-worker-path';

const HEIC_EXTENSIONS = new Set(['heic', 'heif']);
const HEIC_CONVERT_TIMEOUT_MS = 20_000;
const HEIC_WORKER_MEMORY_MB = 256;
const MIN_HEIC_QUALITY = 0.1;
const MAX_HEIC_QUALITY = 1;

type HeicWorkerMessage =
  | { ok: true }
  | { ok: false; error: string };

export function isHeicFile(mimeType: string, fileName: string): boolean {
  const mime = (mimeType || '').toLowerCase();
  if (mime === 'image/heic' || mime === 'image/heif') return true;
  const ext = extensionOf(fileName);
  return HEIC_EXTENSIONS.has(ext);
}

export function heicFileNameToJpeg(fileName: string): string {
  const trimmed = String(fileName ?? '').trim() || 'receipt.heic';
  if (/\.heif$/i.test(trimmed)) return trimmed.replace(/\.heif$/i, '.jpg');
  if (/\.heic$/i.test(trimmed)) return trimmed.replace(/\.heic$/i, '.jpg');
  return `${trimmed.replace(/\.[^.]+$/, '') || 'receipt'}.jpg`;
}

export async function convertHeicBufferToJpeg(buffer: Buffer, quality = 0.92): Promise<Buffer> {
  if (!buffer || buffer.length === 0) {
    throw new Error('Archivo HEIC vacío');
  }
  const safeQuality = clampQuality(quality);
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'avvale-heic-'));
  const inputPath = path.join(tempDir, `${randomUUID()}.heic`);
  const outputPath = path.join(tempDir, `${randomUUID()}.jpg`);
  try {
    await fsp.writeFile(inputPath, buffer);
    await convertHeicFileToJpeg(inputPath, outputPath, safeQuality);
    return await fsp.readFile(outputPath);
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function extensionOf(fileName: string): string {
  const parts = String(fileName ?? '').toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

function convertHeicFileToJpeg(inputPath: string, outputPath: string, quality: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const workerPath = resolveWorkerPath();
    const child = fork(workerPath, [], {
      execArgv: [`--max-old-space-size=${HEIC_WORKER_MEMORY_MB}`],
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    });

    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      child.kill('SIGKILL');
      reject(new Error('Conversión HEIC excedió el tiempo máximo'));
    }, HEIC_CONVERT_TIMEOUT_MS);

    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8').slice(0, 2000);
    });

    child.once('message', (message: HeicWorkerMessage) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.disconnect();
      if (message.ok) {
        resolve();
      } else {
        reject(new Error(message.error));
      }
    });

    child.once('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });

    child.once('exit', (code, signal) => {
      if (settled) return;
      clearTimeout(timer);
      if (code === 0) return;
      settled = true;
      reject(new Error(`Conversión HEIC falló (code=${code ?? 'n/a'}, signal=${signal ?? 'n/a'}): ${stderr}`));
    });

    child.send({ inputPath, outputPath, quality });
  });
}

function clampQuality(quality: number): number {
  if (!Number.isFinite(quality)) return 0.92;
  return Math.min(MAX_HEIC_QUALITY, Math.max(MIN_HEIC_QUALITY, quality));
}

function resolveWorkerPath(): string {
  return resolveIsolatedWorkerPath(__dirname, 'expense-heic-worker');
}
