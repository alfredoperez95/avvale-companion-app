import { BadRequestException, Injectable } from '@nestjs/common';
import { fork } from 'child_process';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

const PDF_PARSE_TIMEOUT_MS = 20_000;
const PDF_WORKER_MEMORY_MB = 192;
const MAX_PDF_OUTPUT_CHARS = 1_000_000;

type PdfWorkerMessage =
  | { ok: true; text: string }
  | { ok: false; error: string };

@Injectable()
export class PdfExtractionService {
  async extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('PDF vacío');
    }

    const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'avvale-pdf-'));
    const tempPath = path.join(tempDir, `${randomUUID()}.pdf`);
    try {
      await fsp.writeFile(tempPath, buffer);
      return await this.extractTextFromPdfFile(tempPath);
    } finally {
      await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private extractTextFromPdfFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const workerPath = resolveWorkerPath();
      const child = fork(workerPath, [], {
        execArgv: [`--max-old-space-size=${PDF_WORKER_MEMORY_MB}`],
        stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
      });

      let stderr = '';
      let settled = false;
      const timer = setTimeout(() => {
        settled = true;
        child.kill('SIGKILL');
        reject(new BadRequestException('Extracción PDF excedió el tiempo máximo'));
      }, PDF_PARSE_TIMEOUT_MS);

      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8').slice(0, 2000);
      });

      child.once('message', (message: PdfWorkerMessage) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        child.disconnect();
        if (message.ok) {
          resolve(message.text);
        } else {
          reject(new BadRequestException(message.error));
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
          new BadRequestException(
            `Extracción PDF falló (code=${code ?? 'n/a'}, signal=${signal ?? 'n/a'}): ${stderr}`,
          ),
        );
      });

      child.send({ filePath, maxChars: MAX_PDF_OUTPUT_CHARS });
    });
  }
}

function resolveWorkerPath(): string {
  const compiled = path.join(__dirname, 'pdf-extraction-worker.js');
  if (fs.existsSync(compiled)) return compiled;

  // Fallback para ejecución directa en TypeScript durante desarrollo con Nest CLI.
  return path.join(__dirname, 'pdf-extraction-worker.ts');
}

