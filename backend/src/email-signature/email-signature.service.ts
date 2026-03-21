import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateEmailSignatureDto } from './dto/update-email-signature.dto';

@Injectable()
export class EmailSignatureService {
  constructor(private readonly prisma: PrismaService) {}

  /** Contenido HTML de la firma global; cadena vacía si no hay registro. */
  async getContent(): Promise<string> {
    const row = await this.prisma.emailSignature.findFirst();
    return row?.content ?? '';
  }

  /** Crea o actualiza la única firma (admin). */
  async upsert(dto: UpdateEmailSignatureDto) {
    const content = dto.content ?? '';
    const existing = await this.prisma.emailSignature.findFirst();
    if (existing) {
      return this.prisma.emailSignature.update({
        where: { id: existing.id },
        data: { content },
        select: { id: true, content: true, updatedAt: true },
      });
    }
    return this.prisma.emailSignature.create({
      data: { content },
      select: { id: true, content: true, updatedAt: true },
    });
  }
}
