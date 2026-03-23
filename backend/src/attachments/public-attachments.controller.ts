import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { AttachmentsService } from './attachments.service';

@Controller('public/attachments')
export class PublicAttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Get(':token')
  async downloadByToken(@Param('token') token: string, @Res() res: Response) {
    const { buffer, fileName, contentType } = await this.attachmentsService.getPublicAttachmentFileByToken(
      token,
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName.replace(/"/g, '\\"')}"`);
    if (contentType) res.setHeader('Content-Type', contentType);
    res.send(buffer);
  }
}
