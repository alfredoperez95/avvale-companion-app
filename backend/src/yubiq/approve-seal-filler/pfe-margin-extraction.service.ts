import { BadRequestException, Injectable } from '@nestjs/common';
import { fork } from 'child_process';
import { randomUUID } from 'crypto';
import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { createRequire } from 'module';
import { resolveIsolatedWorkerPath } from '../../workers/isolated-worker-path';
import type { PfeMarginWorkerMessage } from './pfe-margin-extraction.types';

const PFE_MARGIN_PARSE_TIMEOUT_MS = 15_000;
const PFE_MARGIN_WORKER_MEMORY_MB = 128;
const requireFromHere = createRequire(__filename);

@Injectable()
export class PfeMarginExtractionService {
  async extractMarginPercentageFromBuffer(buffer: Buffer): Promise<number | null> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Excel PFE vacío');
    }

    const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'avvale-pfe-'));
    const tempPath = path.join(tempDir, `${randomUUID()}.xlsx`);
    try {
      await fsp.writeFile(tempPath, buffer);
      return await this.extractMarginPercentageFromFile(tempPath);
    } finally {
      await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private extractMarginPercentageFromFile(filePath: string): Promise<number | null> {
    return new Promise((resolve, reject) => {
      const workerPath = resolveWorkerPath();
      const child = fork(workerPath, [], {
        execArgv: [`--max-old-space-size=${PFE_MARGIN_WORKER_MEMORY_MB}`],
        stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
      });

      let stderr = '';
      let settled = false;
      const timer = setTimeout(() => {
        settled = true;
        child.kill('SIGKILL');
        reject(new BadRequestException('Extracción de margen PFE excedió el tiempo máximo'));
      }, PFE_MARGIN_PARSE_TIMEOUT_MS);

      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8').slice(0, 2000);
      });

      child.once('message', (message: PfeMarginWorkerMessage) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        child.disconnect();
        if (message.ok) {
          resolve(message.marginPercentage);
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
            `Extracción de margen PFE terminó sin respuesta del worker (code=${code ?? 'n/a'}, signal=${signal ?? 'n/a'}): ${stderr}`,
          ),
        );
      });

      child.send({ filePath, xlsxModulePath: requireFromHere.resolve('@stackline/xlsx') });
    });
  }
}

function resolveWorkerPath(): string {
  return resolveIsolatedWorkerPath(__dirname, 'pfe-margin-extraction-worker');
}

