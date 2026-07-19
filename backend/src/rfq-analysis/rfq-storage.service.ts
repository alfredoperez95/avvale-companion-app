import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { validateSafeFile } from '../files/safe-file-validation';
import { resolvePathWithinBase } from '../files/safe-path';

@Injectable()
export class RfqStorageService {
  private readonly baseDir: string;

  constructor(private readonly config: ConfigService) {
    this.baseDir = this.config.get<string>('ATTACHMENTS_DIR') ?? path.join(process.cwd(), 'uploads');
  }

  /**
   * Guarda buffer en rfq-analyses/{analysisId}/... y devuelve ruta relativa al baseDir.
   */
  async saveUploadedFile(
    analysisId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
  ): Promise<{ storedPath: string; fileName: string; mimeType: string }> {
    const safe = validateSafeFile('rfq', {
      buffer: file.buffer,
      originalname: file.originalname || 'document.bin',
      mimetype: file.mimetype,
      size: file.buffer.length,
    });
    const safeName = safe.displayName;
    const storedFileName = safe.storedFileName;
    const relative = path.join('rfq-analyses', analysisId, storedFileName);
    const full = resolvePathWithinBase(this.baseDir, relative);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, file.buffer);
    return {
      storedPath: relative.replace(/\\/g, '/'),
      fileName: safeName,
      mimeType: safe.contentType,
    };
  }

  async readFile(relativePath: string): Promise<Buffer> {
    const full = resolvePathWithinBase(this.baseDir, relativePath);
    return fs.readFile(full);
  }

  resolveStoredPath(relativePath: string): string {
    return resolvePathWithinBase(this.baseDir, relativePath);
  }

  /**
   * Elimina la carpeta del análisis bajo rfq-analyses/{analysisId} (adjuntos subidos).
   */
  async deleteRfqAnalysisFolder(analysisId: string): Promise<void> {
    const full = resolvePathWithinBase(this.baseDir, path.join('rfq-analyses', analysisId));
    await fs.rm(full, { recursive: true, force: true });
  }
}
