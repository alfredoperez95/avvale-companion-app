import { BadRequestException, Injectable } from '@nestjs/common';
import { fork } from 'child_process';
import { randomUUID } from 'crypto';
import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { resolveIsolatedWorkerPath } from '../../workers/isolated-worker-path';

const PDF_PARSE_TIMEOUT_MS = 20_000;
const PDF_SCREENSHOT_TIMEOUT_MS = 45_000;
const PDF_WORKER_MEMORY_MB = 192;
const PDF_SCREENSHOT_WORKER_MEMORY_MB = 384;
const MAX_PDF_OUTPUT_CHARS = 1_000_000;
const DEFAULT_SCREENSHOT_MAX_PAGES = 10;

type PdfWorkerMessage =
  | { ok: true; text: string }
  | { ok: true; pages: { pageNumber: number; fileName: string }[] }
  | { ok: false; error: string };

export type PdfPagePng = {
  pageNumber: number;
  buffer: Buffer;
};

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
      return await this.runWorker<{ ok: true; text: string }>({
        request: { filePath: tempPath, maxChars: MAX_PDF_OUTPUT_CHARS, mode: 'text' },
        timeoutMs: PDF_PARSE_TIMEOUT_MS,
        memoryMb: PDF_WORKER_MEMORY_MB,
      }).then((message) => message.text);
    } finally {
      await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  async renderPagesAsPngBuffers(
    buffer: Buffer,
    options?: { scale?: number; maxPages?: number },
  ): Promise<PdfPagePng[]> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('PDF vacío');
    }

    const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'avvale-pdf-pages-'));
    const tempPath = path.join(tempDir, `${randomUUID()}.pdf`);
    const outputDir = path.join(tempDir, 'pages');
    try {
      await fsp.mkdir(outputDir, { recursive: true });
      await fsp.writeFile(tempPath, buffer);
      const message = await this.runWorker<{ ok: true; pages: { pageNumber: number; fileName: string }[] }>({
        request: {
          filePath: tempPath,
          maxChars: MAX_PDF_OUTPUT_CHARS,
          mode: 'screenshots',
          screenshotScale: options?.scale ?? 1,
          maxPages: options?.maxPages ?? DEFAULT_SCREENSHOT_MAX_PAGES,
          outputDir,
        },
        timeoutMs: PDF_SCREENSHOT_TIMEOUT_MS,
        memoryMb: PDF_SCREENSHOT_WORKER_MEMORY_MB,
      });

      const pages: PdfPagePng[] = [];
      for (const page of message.pages) {
        const filePath = path.join(outputDir, page.fileName);
        const png = await fsp.readFile(filePath);
        pages.push({ pageNumber: page.pageNumber, buffer: png });
      }
      if (!pages.length) {
        throw new BadRequestException('No se pudieron renderizar páginas del PDF');
      }
      return pages;
    } finally {
      await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private runWorker<T extends { ok: true }>(params: {
    request: Record<string, unknown>;
    timeoutMs: number;
    memoryMb: number;
  }): Promise<T> {
    return new Promise((resolve, reject) => {
      const workerPath = resolveWorkerPath();
      const child = fork(workerPath, [], {
        execArgv: [`--max-old-space-size=${params.memoryMb}`],
        stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
      });

      let stderr = '';
      let settled = false;
      const timer = setTimeout(() => {
        settled = true;
        child.kill('SIGKILL');
        reject(new BadRequestException('Extracción PDF excedió el tiempo máximo'));
      }, params.timeoutMs);

      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8').slice(0, 2000);
      });

      child.once('message', (message: PdfWorkerMessage) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        child.disconnect();
        if (message.ok) {
          resolve(message as unknown as T);
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
        settled = true;
        reject(
          new BadRequestException(
            `Extracción PDF terminó sin respuesta del worker (code=${code ?? 'n/a'}, signal=${signal ?? 'n/a'}): ${stderr}`,
          ),
        );
      });

      child.send(params.request);
    });
  }
}

function resolveWorkerPath(): string {
  return resolveIsolatedWorkerPath(__dirname, 'pdf-extraction-worker');
}
