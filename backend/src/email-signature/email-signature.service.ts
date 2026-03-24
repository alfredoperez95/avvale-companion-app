import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateEmailSignatureDto } from './dto/update-email-signature.dto';

@Injectable()
export class EmailSignatureService {
  constructor(private readonly prisma: PrismaService) {}

  /** Firma HTML del usuario; cadena vacía si no hay fila. */
  async getContent(userId: string): Promise<string> {
    const row = await this.prisma.emailSignature.findUnique({ where: { userId } });
    return row?.content ?? '';
  }

  /** Plantilla de firma para clonados / bootstrap (fila userId null). */
  async getSystemTemplateContent(): Promise<string> {
    const row = await this.prisma.emailSignature.findFirst({ where: { userId: null } });
    return row?.content ?? '';
  }

  async upsertForUser(userId: string, dto: UpdateEmailSignatureDto) {
    const content = dto.content ?? '';
    return this.prisma.emailSignature.upsert({
      where: { userId },
      create: { userId, content },
      update: { content },
      select: { id: true, content: true, updatedAt: true },
    });
  }

  async upsertSystemTemplate(dto: UpdateEmailSignatureDto) {
    const content = dto.content ?? '';
    const existing = await this.prisma.emailSignature.findFirst({ where: { userId: null } });
    if (existing) {
      return this.prisma.emailSignature.update({
        where: { id: existing.id },
        data: { content },
        select: { id: true, content: true, updatedAt: true },
      });
    }
    return this.prisma.emailSignature.create({
      data: { userId: null, content },
      select: { id: true, content: true, updatedAt: true },
    });
  }
}
