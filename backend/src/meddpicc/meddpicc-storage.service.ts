import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class MeddpiccStorageService {
  private readonly baseDir: string;

  constructor(private readonly config: ConfigService) {
    this.baseDir = this.config.get<string>('ATTACHMENTS_DIR') ?? path.join(process.cwd(), 'uploads');
  }

  private sanitizeFileName(name: string): string {
    const base = path.basename(name).replace(/[^\w.\- ()\[\]]+/g, '_');
    return base.length > 200 ? base.slice(0, 200) : base;
  }

  /** Ruta relativa a ATTACHMENTS_DIR. */
  async saveUploadedFile(
    dealId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
  ): Promise<{ storedPath: string; fileName: string; mimeType: string }> {
    const safeName = this.sanitizeFileName(file.originalname || 'document.bin');
    const id = randomUUID();
    const storedFileName = `${id}_${safeName}`;
    const relative = path.join('meddpicc-deals', dealId, storedFileName);
    const full = path.join(this.baseDir, relative);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, file.buffer);
    return {
      storedPath: relative.replace(/\\/g, '/'),
      fileName: safeName,
      mimeType: file.mimetype,
    };
  }

  async deleteFile(relativePath: string): Promise<void> {
    const full = path.join(this.baseDir, relativePath);
    await fs.unlink(full).catch(() => undefined);
  }

  async deleteDealFolder(dealId: string): Promise<void> {
    const full = path.join(this.baseDir, 'meddpicc-deals', dealId);
    await fs.rm(full, { recursive: true, force: true });
  }
}
