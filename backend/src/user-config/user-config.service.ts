import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Clona plantillas de sistema, árbol de áreas y firma plantilla para usuarios sin datos propios.
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

    const myAreas = await this.prisma.area.count({ where: { ownerUserId: userId } });
    if (myAreas === 0) {
      const systemAreas = await this.prisma.area.findMany({
        where: { ownerUserId: null },
        include: {
          subAreas: {
            orderBy: { createdAt: 'asc' },
            include: { contacts: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      for (const a of systemAreas) {
        const newArea = await this.prisma.area.create({
          data: {
            name: a.name,
            directorName: a.directorName,
            directorEmail: a.directorEmail,
            ownerUserId: userId,
          },
        });
        for (const s of a.subAreas) {
          const newSub = await this.prisma.subArea.create({
            data: { areaId: newArea.id, name: s.name },
          });
          for (const c of s.contacts) {
            await this.prisma.subAreaContact.create({
              data: {
                subAreaId: newSub.id,
                name: c.name,
                email: c.email,
                isProjectJp: c.isProjectJp,
              },
            });
          }
        }
      }
      if (systemAreas.length > 0) didClone = true;
    }

    return { didClone };
  }
}
