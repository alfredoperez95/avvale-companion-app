import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserPayload } from '../auth/decorators/user-payload';
import { CreateEmailTemplateDto } from './dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';

@Injectable()
export class EmailTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  /** USER / ADMIN: plantillas propias; ADMIN con scope=system: plantillas globales (userId null). */
  findAll(user: UserPayload, systemScope: boolean) {
    const isAdminSystem = user.role === 'ADMIN' && systemScope;
    return this.prisma.emailTemplate.findMany({
      where: { userId: isAdminSystem ? null : user.userId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, content: true, createdAt: true },
    });
  }

  create(user: UserPayload, dto: CreateEmailTemplateDto, asSystem: boolean) {
    if (asSystem) {
      if (user.role !== 'ADMIN') throw new ForbiddenException('Solo administradores crean plantillas de sistema');
      return this.prisma.emailTemplate.create({
        data: { name: dto.name.trim(), content: dto.content ?? '', userId: null },
        select: { id: true, name: true, content: true, createdAt: true },
      });
    }
    return this.prisma.emailTemplate.create({
      data: { name: dto.name.trim(), content: dto.content ?? '', userId: user.userId },
      select: { id: true, name: true, content: true, createdAt: true },
    });
  }

  async update(user: UserPayload, id: string, dto: UpdateEmailTemplateDto) {
    const template = await this.getOrThrow(id);
    this.assertCanModify(template.userId, user);
    return this.prisma.emailTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.content !== undefined && { content: dto.content }),
      },
      select: { id: true, name: true, content: true, createdAt: true },
    });
  }

  async remove(user: UserPayload, id: string) {
    const template = await this.getOrThrow(id);
    this.assertCanModify(template.userId, user);
    await this.prisma.emailTemplate.delete({ where: { id } });
  }

  /**
   * Sustituye todas las plantillas del usuario por copias actuales del catálogo de sistema (userId null).
   * No modifica las plantillas de sistema.
   */
  async restorePersonalFromSystem(user: UserPayload) {
    const systemTemplates = await this.prisma.emailTemplate.findMany({
      where: { userId: null },
      orderBy: { createdAt: 'asc' },
    });
    if (systemTemplates.length === 0) {
      throw new BadRequestException(
        'No hay plantillas de sistema definidas. Un administrador debe crear el catálogo global antes de poder restaurar.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.emailTemplate.deleteMany({ where: { userId: user.userId } });
      for (const t of systemTemplates) {
        await tx.emailTemplate.create({
          data: { name: t.name, content: t.content, userId: user.userId },
        });
      }
    });

    return this.findAll(user, false);
  }

  private assertCanModify(templateUserId: string | null, user: UserPayload) {
    if (templateUserId === null) {
      if (user.role !== 'ADMIN') throw new ForbiddenException('No puedes modificar plantillas de sistema');
    } else if (templateUserId !== user.userId) {
      throw new ForbiddenException('No puedes modificar plantillas de otro usuario');
    }
  }

  private async getOrThrow(id: string) {
    const template = await this.prisma.emailTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Plantilla no encontrada');
    return template;
  }
}
