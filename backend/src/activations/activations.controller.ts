import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards, Res, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ActivationsService } from './activations.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserPayload } from '../auth/decorators/user-payload';
import { ActivationStatus } from '@prisma/client';
import { CreateActivationDto } from './dto/create-activation.dto';
import { UpdateActivationDto } from './dto/update-activation.dto';

@Controller('activations')
@UseGuards(JwtAuthGuard)
export class ActivationsController {
  constructor(
    private readonly activationsService: ActivationsService,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  @Post()
  async create(@CurrentUser() user: UserPayload, @Body() dto: CreateActivationDto) {
    const createdByLabel = user.email;
    return this.activationsService.create(user.userId, createdByLabel, dto);
  }

  @Get()
  async list(@CurrentUser() user: UserPayload, @Query('status') status?: ActivationStatus) {
    if (user.role === 'ADMIN') {
      return this.activationsService.findAllForAdmin({ status });
    }
    return this.activationsService.findAllByUser(user.userId, { status });
  }

  @Get(':id/attachments')
  async listAttachments(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    await this.activationsService.findOneByIdAndUser(id, user.userId);
    return this.attachmentsService.getAttachmentsByActivationId(id);
  }

  @Post(':id/attachments/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAttachment(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('originalUrl') originalUrl?: string,
  ) {
    await this.activationsService.findOneByIdAndUser(id, user.userId);
    if (!file?.buffer) throw new BadRequestException('Falta el archivo');
    const attachment = await this.attachmentsService.saveUploadedFile(
      id,
      { buffer: file.buffer, originalname: file.originalname, mimetype: file.mimetype },
      originalUrl,
    );
    return attachment;
  }

  @Get(':id/attachments/:attachmentId')
  async getAttachmentFile(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ) {
    await this.activationsService.findOneByIdAndUser(id, user.userId);
    const { buffer, fileName, contentType } = await this.attachmentsService.getAttachmentFile(id, attachmentId);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName.replace(/"/g, '\\"')}"`);
    if (contentType) res.setHeader('Content-Type', contentType);
    res.send(buffer);
  }

  @Delete(':id/attachments/:attachmentId')
  async deleteAttachment(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    await this.activationsService.findOneByIdAndUser(id, user.userId);
    await this.attachmentsService.deleteAttachment(id, attachmentId);
    return { ok: true };
  }

  @Get('project-jp-preview')
  async projectJpPreview(
    @Query('areaIds') areaIdsQuery?: string | string[],
    @Query('subAreaIds') subAreaIdsQuery?: string | string[],
    @Query('projectJpContactId') projectJpContactId?: string,
  ) {
    const toArray = (value?: string | string[]) =>
      (Array.isArray(value) ? value : value ? value.split(',') : [])
        .map((v) => v.trim())
        .filter(Boolean);
    return this.activationsService.previewProjectJp(
      toArray(areaIdsQuery),
      toArray(subAreaIdsQuery),
      projectJpContactId?.trim() || null,
    );
  }

  @Get(':id')
  async getOne(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    if (user.role === 'ADMIN') {
      return this.activationsService.findOneById(id);
    }
    return this.activationsService.findOneByIdAndUser(id, user.userId);
  }

  @Post(':id/send')
  async send(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.activationsService.requestSend(id, user.userId);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateActivationDto,
  ) {
    return this.activationsService.update(id, user.userId, dto);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    await this.activationsService.remove(id, user.userId);
  }
}
