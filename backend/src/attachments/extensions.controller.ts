import { Controller, Get, NotFoundException, Res } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs/promises';

@Controller('extensions')
export class ExtensionsController {
  constructor(private readonly config: ConfigService) {}

  @Get('avvale-companion-extension.zip')
  async downloadCompanionExtension(@Res() res: Response) {
    const attachmentsDir =
      this.config.get<string>('ATTACHMENTS_DIR') ?? path.join(process.cwd(), 'uploads');
    const filePath = path.join(attachmentsDir, 'extensions', 'avvale-companion-extension.zip');

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
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.sendFile(filePath);
  }
}

