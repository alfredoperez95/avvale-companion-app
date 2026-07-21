import { Controller, Get, NotFoundException, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Public } from '../auth/decorators/public.decorator';
import { resolvePathWithinBase } from '../files/safe-path';

@Controller('extensions')
@Public()
export class ExtensionsController {
  constructor(private readonly config: ConfigService) {}

  @Get('avvale-companion-extension.zip')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async downloadCompanionExtension(@Res() res: Response) {
    const attachmentsDir =
      this.config.get<string>('ATTACHMENTS_DIR') ?? path.join(process.cwd(), 'uploads');
    const filePath = resolvePathWithinBase(attachmentsDir, path.join('extensions', 'avvale-companion-extension.zip'));

    try {
      await fs.access(filePath);
    } catch {
      throw new NotFoundException(
        'Extensión no disponible en el servidor. Contacta con soporte para publicar el archivo.',
      );
    }

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="avvale-companion-extension.zip"',
    );
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.sendFile(filePath);
  }
}
