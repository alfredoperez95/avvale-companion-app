import { BadRequestException, Controller, Post, Body, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PrismaService } from '../prisma/prisma.service';
import { AttachmentsService } from '../attachments/attachments.service';

@Controller('upload')
export class UploadsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('activationId') activationId?: string,
  ) {
    const trimmedActivationId = (activationId ?? '').trim();
    if (!file || !file.buffer) {
      throw new BadRequestException('Falta el archivo (campo "file")');
    }
    if (!trimmedActivationId) {
      throw new BadRequestException('Falta el campo "activationId"');
    }

    const activation = await this.prisma.activation.findUnique({
      where: { id: trimmedActivationId },
      select: { id: true },
    });
    if (!activation) {
      throw new BadRequestException('La activación indicada no existe');
    }

    const attachment = await this.attachmentsService.saveUploadedFile(
      trimmedActivationId,
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
      },
    );

    return {
      id: attachment.id,
      activationId: attachment.activationId,
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      createdAt: attachment.createdAt,
    };
  }
}

