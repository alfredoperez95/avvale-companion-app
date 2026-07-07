import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { convertHeicBufferToJpeg, heicFileNameToJpeg, isHeicFile } from './expense-image.utils';

@Injectable()
export class ExpenseStorageService {
  private readonly baseDir: string;

  constructor(private readonly config: ConfigService) {
    this.baseDir = this.config.get<string>('ATTACHMENTS_DIR') ?? path.join(process.cwd(), 'uploads');
  }

  private sanitizeFileName(name: string): string {
    const base = path.basename(name).replace(/[^\w.\- ()\[\]]+/g, '_');
    return base.length > 200 ? base.slice(0, 200) : base;
  }

  async saveUploadedFile(
    expenseId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
  ): Promise<{ storedPath: string; fileName: string; mimeType: string }> {
    let buffer = file.buffer;
    let safeName = this.sanitizeFileName(file.originalname || 'receipt.bin');
    let mimeType = file.mimetype || 'application/octet-stream';

    if (isHeicFile(mimeType, safeName)) {
      try {
        buffer = await convertHeicBufferToJpeg(buffer);
        safeName = heicFileNameToJpeg(safeName);
        mimeType = 'image/jpeg';
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new BadRequestException(
          `No se pudo convertir el archivo HEIC a JPG. Detalle: ${message}`,
        );
      }
    }

    const storedFileName = `${randomUUID()}_${safeName}`;
    const relative = path.join('expenses', expenseId, storedFileName);
    const full = path.join(this.baseDir, relative);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, buffer);
    return {
      storedPath: relative.replace(/\\/g, '/'),
      fileName: safeName,
      mimeType,
    };
  }

  async readFile(relativePath: string): Promise<Buffer> {
    return fs.readFile(path.join(this.baseDir, relativePath));
  }

  async deleteExpenseFolder(expenseId: string): Promise<void> {
    await fs.rm(path.join(this.baseDir, 'expenses', expenseId), { recursive: true, force: true });
  }
}
