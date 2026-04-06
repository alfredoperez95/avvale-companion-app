import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class RfqStorageService {
  private readonly baseDir: string;

  constructor(private readonly config: ConfigService) {
    this.baseDir = this.config.get<string>('ATTACHMENTS_DIR') ?? path.join(process.cwd(), 'uploads');
  }

  private sanitizeFileName(name: string): string {
    const base = path.basename(name).replace(/[^\w.\- ()\[\]]+/g, '_');
    return base.length > 200 ? base.slice(0, 200) : base;
  }

  /**
   * Guarda buffer en rfq-analyses/{analysisId}/... y devuelve ruta relativa al baseDir.
   */
  async saveUploadedFile(
    analysisId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
  ): Promise<{ storedPath: string; fileName: string; mimeType: string }> {
    const safeName = this.sanitizeFileName(file.originalname || 'document.bin');
    const id = randomUUID();
    const storedFileName = `${id}_${safeName}`;
    const relative = path.join('rfq-analyses', analysisId, storedFileName);
    const full = path.join(this.baseDir, relative);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, file.buffer);
    return {
      storedPath: relative.replace(/\\/g, '/'),
      fileName: safeName,
      mimeType: file.mimetype,
    };
  }

  async readFile(relativePath: string): Promise<Buffer> {
    const full = path.join(this.baseDir, relativePath);
    return fs.readFile(full);
  }

  /**
   * Elimina la carpeta del análisis bajo rfq-analyses/{analysisId} (adjuntos subidos).
   */
  async deleteRfqAnalysisFolder(analysisId: string): Promise<void> {
    const full = path.join(this.baseDir, 'rfq-analyses', analysisId);
    await fs.rm(full, { recursive: true, force: true });
  }
}
