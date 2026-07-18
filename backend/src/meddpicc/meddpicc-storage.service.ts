import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { validateSafeFile } from '../files/safe-file-validation';
import { resolvePathWithinBase } from '../files/safe-path';

@Injectable()
export class MeddpiccStorageService {
  private readonly baseDir: string;

  constructor(private readonly config: ConfigService) {
    this.baseDir = this.config.get<string>('ATTACHMENTS_DIR') ?? path.join(process.cwd(), 'uploads');
  }

  /** Ruta relativa a ATTACHMENTS_DIR. */
  async saveUploadedFile(
    dealId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
  ): Promise<{ storedPath: string; fileName: string; mimeType: string }> {
    const safe = validateSafeFile('meddpicc', {
      buffer: file.buffer,
      originalname: file.originalname || 'document.bin',
      mimetype: file.mimetype,
      size: file.buffer.length,
    });
    const safeName = safe.displayName;
    const storedFileName = safe.storedFileName;
    const relative = path.join('meddpicc-deals', dealId, storedFileName);
    const full = resolvePathWithinBase(this.baseDir, relative);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, file.buffer);
    return {
      storedPath: relative.replace(/\\/g, '/'),
      fileName: safeName,
      mimeType: safe.contentType,
    };
  }

  async deleteFile(relativePath: string): Promise<void> {
    const full = resolvePathWithinBase(this.baseDir, relativePath);
    await fs.unlink(full).catch(() => undefined);
  }

  async deleteDealFolder(dealId: string): Promise<void> {
    const full = resolvePathWithinBase(this.baseDir, path.join('meddpicc-deals', dealId));
    await fs.rm(full, { recursive: true, force: true });
  }
}
