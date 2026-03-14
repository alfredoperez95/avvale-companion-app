import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmailTemplateDto } from './dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';

@Injectable()
export class EmailTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista plantillas ordenadas por nombre. */
  findAll() {
    return this.prisma.emailTemplate.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, content: true, createdAt: true },
    });
  }

  /** Crea una plantilla (admin). */
  create(dto: CreateEmailTemplateDto) {
    return this.prisma.emailTemplate.create({
      data: {
        name: dto.name.trim(),
        content: dto.content ?? '',
      },
      select: { id: true, name: true, content: true, createdAt: true },
    });
  }

  /** Actualiza una plantilla (admin). */
  async update(id: string, dto: UpdateEmailTemplateDto) {
    await this.getOrThrow(id);
    return this.prisma.emailTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.content !== undefined && { content: dto.content }),
      },
      select: { id: true, name: true, content: true, createdAt: true },
    });
  }

  /** Elimina una plantilla (admin). */
  async remove(id: string) {
    await this.getOrThrow(id);
    await this.prisma.emailTemplate.delete({ where: { id } });
  }

  private async getOrThrow(id: string) {
    const template = await this.prisma.emailTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Plantilla no encontrada');
    return template;
  }
}
