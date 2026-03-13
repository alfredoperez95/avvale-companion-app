import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';

const DOWNLOAD_TIMEOUT_MS = 30_000;
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export interface DownloadResult {
  saved: string[];
  failed: { url: string; error: string }[];
}

@Injectable()
export class AttachmentsService {
  private readonly baseDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.baseDir = this.config.get<string>('ATTACHMENTS_DIR') ?? path.join(process.cwd(), 'uploads');
  }

  private async ensureDir(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  private isValidUrl(url: string): boolean {
    try {
      const u = new URL(url);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private getExtensionFromUrl(url: string): string {
    try {
      const u = new URL(url);
      const pathname = u.pathname;
      const last = pathname.split('/').pop();
      if (last?.includes('.')) {
        const ext = path.extname(last);
        if (ext && ext.length <= 10) return ext;
      }
    } catch {
      // ignore
    }
    return '.bin';
  }

  /** Infiere extensión desde Content-Type cuando la URL no la trae. */
  private getExtensionFromContentType(contentType: string | undefined): string {
    if (!contentType) return '.bin';
    const mime = contentType.split(';')[0].trim().toLowerCase();
    const map: Record<string, string> = {
      'application/pdf': '.pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
      'application/vnd.ms-powerpoint': '.ppt',
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'text/plain': '.txt',
      'text/csv': '.csv',
      'application/zip': '.zip',
    };
    return map[mime] ?? '.bin';
  }

  private getFileNameFromContentDisposition(header: string | null): string | null {
    if (!header) return null;
    const match = header.match(/filename\*?=(?:UTF-8'')?["']?([^"'\s;]+)["']?/i) ?? header.match(/filename=["']?([^"'\s;]+)["']?/i);
    return match ? decodeURIComponent(match[1].trim()) : null;
  }

  /** Descarga un archivo desde una URL. Solo HTTP/HTTPS. */
  async downloadFromUrl(
    url: string,
  ): Promise<{ buffer: Buffer; contentType?: string; suggestedName?: string }> {
    if (!this.isValidUrl(url)) {
      throw new Error('URL no permitida: solo http o https');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'User-Agent': 'AvvaleCompanion/1.0' },
      });
      clearTimeout(timeout);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const contentType = res.headers.get('content-type')?.split(';')[0].trim() ?? undefined;
      const suggestedName = this.getFileNameFromContentDisposition(res.headers.get('content-disposition'));
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      if (buffer.length > MAX_FILE_SIZE_BYTES) {
        throw new Error(`Archivo demasiado grande (máx ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB)`);
      }
      return { buffer, contentType, suggestedName: suggestedName ?? undefined };
    } catch (e) {
      clearTimeout(timeout);
      const message = e instanceof Error ? e.message : 'Error desconocido';
      throw new Error(message);
    }
  }

  /** Descarga las URLs y guarda los archivos asociados a la activación. */
  async saveActivationAttachments(activationId: string, urls: string[]): Promise<DownloadResult> {
    const saved: string[] = [];
    const failed: { url: string; error: string }[] = [];
    const activationDir = path.join(this.baseDir, 'activations', activationId);
    await this.ensureDir(activationDir);

    for (const originalUrl of urls) {
      const trimmed = originalUrl.trim();
      if (!trimmed) continue;
      try {
        const { buffer, contentType, suggestedName } = await this.downloadFromUrl(trimmed);
        let ext = this.getExtensionFromUrl(trimmed);
        if (ext === '.bin' && contentType) ext = this.getExtensionFromContentType(contentType);
        const fileId = randomUUID();
        const hasSuggestedExt = suggestedName && path.extname(suggestedName);
        const baseFromSuggested = suggestedName ? path.basename(suggestedName).replace(/[^a-zA-Z0-9._-]/g, '_') : '';
        const safeFileName =
          hasSuggestedExt
            ? baseFromSuggested
            : baseFromSuggested
              ? `${baseFromSuggested}${ext}`
              : `documento_${fileId}${ext}`;
        const storedFileName = `${fileId}_${safeFileName}`;
        const storedPath = path.join('activations', activationId, storedFileName);
        const fullPath = path.join(this.baseDir, storedPath);
        await fs.writeFile(fullPath, buffer);
        await this.prisma.activationAttachment.create({
          data: {
            activationId,
            originalUrl: trimmed,
            storedPath,
            fileName: safeFileName,
            contentType: contentType ?? null,
          },
        });
        saved.push(trimmed);
      } catch (e) {
        failed.push({
          url: trimmed,
          error: e instanceof Error ? e.message : 'Error desconocido',
        });
      }
    }
    return { saved, failed };
  }

  /** Guarda un archivo subido desde el navegador (p. ej. descargado por el usuario desde HubSpot). */
  async saveUploadedFile(
    activationId: string,
    file: { buffer: Buffer; originalname: string; mimetype?: string },
    originalUrl?: string,
  ) {
    const ext = path.extname(file.originalname) || this.getExtensionFromContentType(file.mimetype);
    const fileId = randomUUID();
    const baseName = path.basename(file.originalname, path.extname(file.originalname)).replace(/[^a-zA-Z0-9._-]/g, '_') || 'documento';
    const safeFileName = `${baseName}${ext}`;
    const storedFileName = `${fileId}_${safeFileName}`;
    const storedPath = path.join('activations', activationId, storedFileName);
    const activationDir = path.join(this.baseDir, 'activations', activationId);
    await this.ensureDir(activationDir);
    const fullPath = path.join(this.baseDir, storedPath);
    await fs.writeFile(fullPath, file.buffer);
    return this.prisma.activationAttachment.create({
      data: {
        activationId,
        originalUrl: originalUrl?.trim() || '',
        storedPath,
        fileName: safeFileName,
        contentType: file.mimetype?.split(';')[0].trim() || null,
      },
    });
  }

  /** Lista los adjuntos descargados de una activación. */
  async getAttachmentsByActivationId(activationId: string) {
    return this.prisma.activationAttachment.findMany({
      where: { activationId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, fileName: true, originalUrl: true, contentType: true, createdAt: true },
    });
  }

  /** Devuelve el buffer del archivo y su contentType. Comprueba que el adjunto pertenezca a la activación. */
  async getAttachmentFile(
    activationId: string,
    attachmentId: string,
  ): Promise<{ buffer: Buffer; fileName: string; contentType: string | null }> {
    const attachment = await this.prisma.activationAttachment.findFirst({
      where: { id: attachmentId, activationId },
    });
    if (!attachment) throw new NotFoundException('Adjunto no encontrado');
    const fullPath = path.join(this.baseDir, attachment.storedPath);
    try {
      const buffer = await fs.readFile(fullPath);
      return {
        buffer,
        fileName: attachment.fileName,
        contentType: attachment.contentType,
      };
    } catch {
      throw new NotFoundException('Archivo no encontrado en disco');
    }
  }

  /** Elimina todos los adjuntos de una activación (registros y archivos). */
  async deleteAttachmentsForActivation(activationId: string): Promise<void> {
    const list = await this.prisma.activationAttachment.findMany({
      where: { activationId },
      select: { id: true, storedPath: true },
    });
    const dir = path.join(this.baseDir, 'activations', activationId);
    for (const a of list) {
      const fullPath = path.join(this.baseDir, a.storedPath);
      try {
        await fs.unlink(fullPath);
      } catch {
        // ignore si el archivo ya no existe
      }
    }
    try {
      await fs.rmdir(dir, { recursive: true });
    } catch {
      // ignore
    }
    await this.prisma.activationAttachment.deleteMany({ where: { activationId } });
  }
}
