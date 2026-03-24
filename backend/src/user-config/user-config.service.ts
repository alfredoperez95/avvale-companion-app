import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Clona plantillas de sistema y firma plantilla para usuarios sin datos propios.
 * El catálogo de áreas es global (solo administradores); no se clonan árboles por usuario.
 */
@Injectable()
export class UserConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /** Idempotente: seguro llamar en cada sesión. */
  async ensureUserDefaults(userId: string): Promise<{ didClone: boolean }> {
    let didClone = false;

    const systemSig = await this.prisma.emailSignature.findFirst({ where: { userId: null } });
    const defaultSigContent = systemSig?.content ?? '';

    const mySig = await this.prisma.emailSignature.findUnique({ where: { userId } });
    if (!mySig) {
      await this.prisma.emailSignature.create({
        data: { userId, content: defaultSigContent },
      });
      didClone = true;
    }

    const myTemplateCount = await this.prisma.emailTemplate.count({ where: { userId } });
    if (myTemplateCount === 0) {
      const systemTemplates = await this.prisma.emailTemplate.findMany({
        where: { userId: null },
        orderBy: { createdAt: 'asc' },
      });
      for (const t of systemTemplates) {
        await this.prisma.emailTemplate.create({
          data: { name: t.name, content: t.content, userId },
        });
      }
      if (systemTemplates.length > 0) didClone = true;
    }

    return { didClone };
  }
}
