import { fork } from 'child_process';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';

/** Límite aproximado de caracteres extraídos por fichero (evita cargas enormes en contexto). */
const MAX_SPREADSHEET_OUTPUT_CHARS = 500_000;
const SPREADSHEET_PARSE_TIMEOUT_MS = 15_000;
const SPREADSHEET_WORKER_MEMORY_MB = 128;

type SpreadsheetWorkerMessage =
  | { ok: true; text: string }
  | { ok: false; error: string };

/**
 * Extrae texto plano desde Excel en un proceso hijo para aislar parser/CPU/memoria del backend Nest.
 */
export function extractTextFromSpreadsheetFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const workerPath = resolveWorkerPath();
    const child = fork(workerPath, [], {
      execArgv: [`--max-old-space-size=${SPREADSHEET_WORKER_MEMORY_MB}`],
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    });

    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      child.kill('SIGKILL');
      reject(new Error('Extracción Excel excedió el tiempo máximo'));
    }, SPREADSHEET_PARSE_TIMEOUT_MS);

    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8').slice(0, 2000);
    });

    child.once('message', (message: SpreadsheetWorkerMessage) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.disconnect();
      if (message.ok) {
        resolve(message.text);
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
      reject(new Error(`Extracción Excel falló (code=${code ?? 'n/a'}, signal=${signal ?? 'n/a'}): ${stderr}`));
    });

    child.send({ filePath, maxChars: MAX_SPREADSHEET_OUTPUT_CHARS });
  });
}

export async function extractTextFromSpreadsheetBuffer(buf: Buffer): Promise<string> {
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'avvale-spreadsheet-'));
  const tempPath = path.join(tempDir, `${randomUUID()}.xlsx`);
  try {
    await fsp.writeFile(tempPath, buf);
    return await extractTextFromSpreadsheetFile(tempPath);
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export function isSpreadsheetOfficeMime(mimeType: string): boolean {
  const mt = (mimeType || '').toLowerCase();
  return (
    mt === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mt === 'application/vnd.ms-excel' ||
    mt.includes('spreadsheetml')
  );
}

/** Si el MIME viene genérico, la extensión permite tratar el buffer como Excel. */
export function looksLikeSpreadsheetFileName(fileName: string | null | undefined): boolean {
  if (!fileName) return false;
  const n = fileName.toLowerCase();
  return n.endsWith('.xlsx') || n.endsWith('.xls') || n.endsWith('.xlsm');
}

function resolveWorkerPath(): string {
  const compiled = path.join(__dirname, 'rfq-spreadsheet-worker.js');
  if (fs.existsSync(compiled)) return compiled;

  // Fallback para ejecución directa en TypeScript durante desarrollo con Nest CLI.
  return path.join(__dirname, 'rfq-spreadsheet-worker.ts');
}
