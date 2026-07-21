import { fork } from 'child_process';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

const DOCUMENT_PARSE_TIMEOUT_MS = 20_000;
const DOCUMENT_WORKER_MEMORY_MB = 192;
const MAX_DOCUMENT_OUTPUT_CHARS = 300_000;

type DocumentKind = 'docx' | 'eml';

type DocumentWorkerMessage =
  | { ok: true; markdown: string }
  | { ok: false; error: string };

export async function extractDocxToMarkdown(buffer: Buffer): Promise<string> {
  return extractDocumentToMarkdown(buffer, 'docx', '.docx');
}

export async function extractEmlToMarkdown(buffer: Buffer): Promise<string> {
  return extractDocumentToMarkdown(buffer, 'eml', '.eml');
}

async function extractDocumentToMarkdown(buffer: Buffer, kind: DocumentKind, extension: string): Promise<string> {
  if (!buffer || buffer.length === 0) {
    throw new Error('Documento vacío');
  }

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'avvale-document-'));
  const inputPath = path.join(tempDir, `${randomUUID()}${extension}`);
  try {
    await fsp.writeFile(inputPath, buffer);
    return await extractDocumentFileToMarkdown(inputPath, kind);
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function extractDocumentFileToMarkdown(filePath: string, kind: DocumentKind): Promise<string> {
  return new Promise((resolve, reject) => {
    const workerPath = resolveWorkerPath();
    const child = fork(workerPath, [], {
      execArgv: [`--max-old-space-size=${DOCUMENT_WORKER_MEMORY_MB}`],
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    });

    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      child.kill('SIGKILL');
      reject(new Error('Extracción de documento excedió el tiempo máximo'));
    }, DOCUMENT_PARSE_TIMEOUT_MS);

    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8').slice(0, 2000);
    });

    child.once('message', (message: DocumentWorkerMessage) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.disconnect();
      if (message.ok) {
        resolve(message.markdown);
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
      reject(
        new Error(
          `Extracción de documento falló (code=${code ?? 'n/a'}, signal=${signal ?? 'n/a'}): ${stderr}`,
        ),
      );
    });

    child.send({ filePath, kind, maxChars: MAX_DOCUMENT_OUTPUT_CHARS });
  });
}

function resolveWorkerPath(): string {
  const compiled = path.join(__dirname, 'meddpicc-document-worker.js');
  if (fs.existsSync(compiled)) return compiled;

  // Fallback para ejecución directa en TypeScript durante desarrollo con Nest CLI.
  return path.join(__dirname, 'meddpicc-document-worker.ts');
}
