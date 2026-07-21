import { Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { randomUUID } from 'crypto';
import { validateSafeFile } from '../files/safe-file-validation';
import { resolvePathWithinBase } from '../files/safe-path';

const DOWNLOAD_TIMEOUT_MS = 30_000;
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
const PUBLIC_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const MAX_DOWNLOAD_REDIRECTS = 3;
const DEFAULT_PUBLIC_ATTACHMENT_TTL_MINUTES = 60;
const UUID_TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface DownloadResult {
  saved: string[];
  failed: { url: string; error: string }[];
  /** URLs de HubSpot (requieren sesión; no se descargan en servidor). */
  skippedHubSpot: string[];
  /** Ya existía un adjunto con la misma `originalUrl` para esta activación. */
  skippedAlreadyPresent: string[];
}

@Injectable()
export class AttachmentsService implements OnModuleInit, OnModuleDestroy {
  private readonly baseDir: string;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.baseDir = this.config.get<string>('ATTACHMENTS_DIR') ?? path.join(process.cwd(), 'uploads');
  }

  onModuleInit() {
    this.cleanupTimer = setInterval(() => {
      this.clearExpiredPublicAccess().catch(() => undefined);
    }, PUBLIC_CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = null;
  }

  buildPublicUrl(baseUrl: string, token: string): string {
    const normalized = baseUrl.trim().replace(/\/+$/, '');
    return `${normalized}/public/attachments/${token}`;
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

  private isBlockedHostname(hostname: string): boolean {
    const h = hostname.toLowerCase();
    return h === 'localhost' || h.endsWith('.localhost') || h === 'metadata.google.internal';
  }

  private isPrivateIpAddress(address: string): boolean {
    if (address === '169.254.169.254') return true;
    if (isIP(address) === 6) {
      const lower = address.toLowerCase();
      return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:');
    }
    const parts = address.split('.').map((p) => Number.parseInt(p, 10));
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return true;
    const [a, b] = parts;
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a === 0
    );
  }

  private async assertPublicDownloadTarget(rawUrl: string): Promise<URL> {
    const u = new URL(rawUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw new Error('URL no permitida: solo http o https');
    }
    if (this.isBlockedHostname(u.hostname)) {
      throw new Error('URL no permitida: host interno');
    }
    const addresses = await lookup(u.hostname, { all: true, verbatim: true });
    if (addresses.length === 0 || addresses.some((entry) => this.isPrivateIpAddress(entry.address))) {
      throw new Error('URL no permitida: destino privado o local');
    }
    return u;
  }

  /** URLs de HubSpot requieren sesión; el backend no la tiene, no intentar descargar. */
  private isHubSpotUrl(url: string): boolean {
    try {
      const u = new URL(url);
      return u.hostname === 'app.hubspot.com' || u.hostname.endsWith('.hubspot.com');
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
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'image/bmp': '.bmp',
      'image/tiff': '.tiff',
      'text/plain': '.txt',
      'text/csv': '.csv',
      'text/html': '.html',
      'text/xml': '.xml',
      'application/zip': '.zip',
      'application/x-zip-compressed': '.zip',
      'application/json': '.json',
      'application/xml': '.xml',
      'application/vnd.oasis.opendocument.text': '.odt',
      'application/vnd.oasis.opendocument.spreadsheet': '.ods',
      'application/vnd.oasis.opendocument.presentation': '.odp',
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
    if (!this.isValidUrl(url)) throw new Error('URL no permitida: solo http o https');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
    try {
      let current = url;
      let res: Response | null = null;
      for (let i = 0; i <= MAX_DOWNLOAD_REDIRECTS; i++) {
        await this.assertPublicDownloadTarget(current);
        res = await fetch(current, {
          signal: controller.signal,
          redirect: 'manual',
          headers: { 'User-Agent': 'AvvaleCompanion/1.0' },
        });
        if (![301, 302, 303, 307, 308].includes(res.status)) break;
        const location = res.headers.get('location');
        if (!location) throw new Error('Redirect sin Location');
        current = new URL(location, current).toString();
      }
      clearTimeout(timeout);
      if (!res) throw new Error('No se pudo descargar el archivo');
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        throw new Error('Demasiadas redirecciones');
      }
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
    const skippedHubSpot: string[] = [];
    const skippedAlreadyPresent: string[] = [];

    const existing = await this.prisma.activationAttachment.findMany({
      where: { activationId },
      select: { originalUrl: true },
    });
    const alreadyImported = new Set(existing.map((e) => e.originalUrl.trim()).filter(Boolean));

    const activationDir = path.join(this.baseDir, 'activations', activationId);
    await this.ensureDir(activationDir);

    for (const originalUrl of urls) {
      const trimmed = originalUrl.trim();
      if (!trimmed) continue;
      if (this.isHubSpotUrl(trimmed)) {
        skippedHubSpot.push(trimmed);
        continue;
      }
      if (alreadyImported.has(trimmed)) {
        skippedAlreadyPresent.push(trimmed);
        continue;
      }
      try {
        const { buffer, contentType, suggestedName } = await this.downloadFromUrl(trimmed);
        const fallbackExt = this.getExtensionFromUrl(trimmed);
        const inferredExt = fallbackExt === '.bin' && contentType ? this.getExtensionFromContentType(contentType) : fallbackExt;
        const originalname = suggestedName || `documento${inferredExt}`;
        const safe = validateSafeFile('activation', {
          buffer,
          originalname,
          mimetype: contentType,
          size: buffer.length,
        });
        const safeFileName = safe.displayName;
        const storedFileName = safe.storedFileName;
        const storedPath = path.join('activations', activationId, storedFileName);
        const fullPath = resolvePathWithinBase(this.baseDir, storedPath);
        await fs.writeFile(fullPath, buffer);
        await this.prisma.activationAttachment.create({
          data: {
            activationId,
            originalUrl: trimmed,
            storedPath,
            fileName: safeFileName,
            contentType: safe.contentType,
          },
        });
        saved.push(trimmed);
        alreadyImported.add(trimmed);
      } catch (e) {
        failed.push({
          url: trimmed,
          error: e instanceof Error ? e.message : 'Error desconocido',
        });
      }
    }
    return { saved, failed, skippedHubSpot, skippedAlreadyPresent };
  }

  /** Guarda un archivo subido desde el navegador (p. ej. descargado por el usuario desde HubSpot). */
  async saveUploadedFile(
    activationId: string,
    file: { buffer: Buffer; originalname: string; mimetype?: string },
    originalUrl?: string,
  ) {
    const safe = validateSafeFile('activation', {
      buffer: file.buffer,
      originalname: file.originalname || 'documento.bin',
      mimetype: file.mimetype,
      size: file.buffer.length,
    });
    const safeFileName = safe.displayName;
    const storedFileName = safe.storedFileName;
    const storedPath = path.join('activations', activationId, storedFileName);
    const activationDir = path.join(this.baseDir, 'activations', activationId);
    await this.ensureDir(activationDir);
    const fullPath = resolvePathWithinBase(this.baseDir, storedPath);
    await fs.writeFile(fullPath, file.buffer);
    return this.prisma.activationAttachment.create({
      data: {
        activationId,
        originalUrl: originalUrl?.trim() || '',
        storedPath,
        fileName: safeFileName,
        contentType: safe.contentType,
      },
    });
  }

  /** Lista los adjuntos descargados de una activación (incluye tamaño en disco). */
  async getAttachmentsByActivationId(activationId: string) {
    const rows = await this.prisma.activationAttachment.findMany({
      where: { activationId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        fileName: true,
        originalUrl: true,
        contentType: true,
        createdAt: true,
        storedPath: true,
        publicToken: true,
      },
    });
    return Promise.all(
      rows.map(async (r) => {
        let fileSizeBytes: number | null = null;
        try {
          const st = await fs.stat(resolvePathWithinBase(this.baseDir, r.storedPath));
          fileSizeBytes = st.size;
        } catch {
          fileSizeBytes = null;
        }
        return {
          id: r.id,
          fileName: r.fileName,
          originalUrl: r.originalUrl,
          contentType: r.contentType,
          createdAt: r.createdAt,
          publicToken: r.publicToken,
          fileSizeBytes,
        };
      }),
    );
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
    const fullPath = resolvePathWithinBase(this.baseDir, attachment.storedPath);
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

  /** Publica adjuntos con token no adivinable y caducidad defensiva. */
  async publishForActivation(activationId: string): Promise<void> {
    const ttlMinutes = parseInt(
      this.config.get<string>('PUBLIC_ATTACHMENT_DEFAULT_TTL_MINUTES') ??
        String(DEFAULT_PUBLIC_ATTACHMENT_TTL_MINUTES),
      10,
    );
    const publicExpiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    const attachments = await this.prisma.activationAttachment.findMany({
      where: { activationId },
      select: { id: true, publicToken: true },
    });
    for (const a of attachments) {
      await this.prisma.activationAttachment.update({
        where: { id: a.id },
        data: {
          publicToken: a.publicToken ?? randomUUID(),
          publishedAt: new Date(),
          publicExpiresAt,
        },
      });
    }
  }

  /** Programa expiración de URLs públicas para una activación (p. ej. SENT + 30 min). */
  async schedulePublicExpiryForActivation(activationId: string, ttlMinutes: number): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    await this.prisma.activationAttachment.updateMany({
      where: { activationId, publicToken: { not: null } },
      data: { publicExpiresAt: expiresAt },
    });
  }

  /** Revoca acceso público expirado sin borrar archivos físicos. */
  async clearExpiredPublicAccess(): Promise<number> {
    const now = new Date();
    const result = await this.prisma.activationAttachment.updateMany({
      where: { publicToken: { not: null }, publicExpiresAt: { lte: now } },
      data: { publicToken: null, publicExpiresAt: null, publishedAt: null },
    });
    return result.count;
  }

  /** Descarga pública temporal por token no adivinable. */
  async getPublicAttachmentFileByToken(
    token: string,
  ): Promise<{ buffer: Buffer; fileName: string; contentType: string | null }> {
    const normalizedToken = token.trim();
    if (!UUID_TOKEN_RE.test(normalizedToken)) {
      throw new NotFoundException('Adjunto público no encontrado o expirado');
    }
    const now = new Date();
    const attachment = await this.prisma.activationAttachment.findFirst({
      where: {
        publicToken: normalizedToken,
        publicExpiresAt: { gt: now },
      },
      select: { storedPath: true, fileName: true, contentType: true },
    });
    if (!attachment) throw new NotFoundException('Adjunto público no encontrado o expirado');
    const fullPath = resolvePathWithinBase(this.baseDir, attachment.storedPath);
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

  /** Elimina un solo adjunto (registro y archivo en disco). */
  async deleteAttachment(activationId: string, attachmentId: string): Promise<void> {
    const attachment = await this.prisma.activationAttachment.findFirst({
      where: { id: attachmentId, activationId },
      select: { id: true, storedPath: true },
    });
    if (!attachment) throw new NotFoundException('Adjunto no encontrado');
    const fullPath = resolvePathWithinBase(this.baseDir, attachment.storedPath);
    try {
      await fs.unlink(fullPath);
    } catch {
      // ignore si el archivo ya no existe
    }
    await this.prisma.activationAttachment.delete({ where: { id: attachmentId } });
  }

  /** Elimina todos los adjuntos de una activación (registros y archivos). */
  async deleteAttachmentsForActivation(activationId: string): Promise<void> {
    const list = await this.prisma.activationAttachment.findMany({
      where: { activationId },
      select: { id: true, storedPath: true },
    });
    const dir = path.join(this.baseDir, 'activations', activationId);
    for (const a of list) {
      const fullPath = resolvePathWithinBase(this.baseDir, a.storedPath);
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
