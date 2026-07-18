import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { convertHeicBufferToJpeg, heicFileNameToJpeg, isHeicFile } from './expense-image.utils';
import { validateSafeFile } from '../files/safe-file-validation';
import { resolvePathWithinBase } from '../files/safe-path';

@Injectable()
export class ExpenseStorageService {
  private readonly baseDir: string;

  constructor(private readonly config: ConfigService) {
    this.baseDir = this.config.get<string>('ATTACHMENTS_DIR') ?? path.join(process.cwd(), 'uploads');
  }

  async saveUploadedFile(
    expenseId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
  ): Promise<{ storedPath: string; fileName: string; mimeType: string }> {
    let safe = validateSafeFile('expense', {
      buffer: file.buffer,
      originalname: file.originalname || 'receipt.bin',
      mimetype: file.mimetype,
      size: file.buffer.length,
    });
    let buffer = safe.buffer;
    let safeName = safe.displayName;
    let mimeType = safe.contentType;

    if (isHeicFile(mimeType, safeName)) {
      try {
        buffer = await convertHeicBufferToJpeg(buffer);
        safeName = heicFileNameToJpeg(safeName);
        mimeType = 'image/jpeg';
        safe = validateSafeFile('expense', {
          buffer,
          originalname: safeName,
          mimetype: mimeType,
          size: buffer.length,
        });
        safeName = safe.displayName;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new BadRequestException(
          `No se pudo convertir el archivo HEIC a JPG. Detalle: ${message}`,
        );
      }
    }

    const storedFileName = safe.storedFileName;
    const relative = path.join('expenses', expenseId, storedFileName);
    const full = resolvePathWithinBase(this.baseDir, relative);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, buffer);
    return {
      storedPath: relative.replace(/\\/g, '/'),
      fileName: safeName,
      mimeType,
    };
  }

  async readFile(relativePath: string): Promise<Buffer> {
    return fs.readFile(resolvePathWithinBase(this.baseDir, relativePath));
  }

  async deleteExpenseFolder(expenseId: string): Promise<void> {
    await fs.rm(resolvePathWithinBase(this.baseDir, path.join('expenses', expenseId)), {
      recursive: true,
      force: true,
    });
  }
}
