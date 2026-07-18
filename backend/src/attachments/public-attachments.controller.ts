import { Controller, Get, Param, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AttachmentsService } from './attachments.service';

@Controller('public/attachments')
export class PublicAttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Get(':token')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async downloadByToken(@Param('token') token: string, @Res() res: Response) {
    const { buffer, fileName, contentType } = await this.attachmentsService.getPublicAttachmentFileByToken(
      token,
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName.replace(/"/g, '\\"')}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', contentType || 'application/octet-stream');
    res.send(buffer);
  }
}
