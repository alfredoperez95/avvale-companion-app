import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCcContactDto } from './dto/create-cc-contact.dto';
import { UpdateCcContactDto } from './dto/update-cc-contact.dto';

@Injectable()
export class CcContactsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista contactos CC ordenados por nombre (id, name, email). */
  findAll() {
    return this.prisma.ccContact.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true },
    });
  }

  /** Crea un contacto CC (admin). */
  create(dto: CreateCcContactDto) {
    return this.prisma.ccContact.create({
      data: {
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
      },
      select: { id: true, name: true, email: true },
    });
  }

  /** Actualiza un contacto CC (admin). */
  async update(id: string, dto: UpdateCcContactDto) {
    await this.getOrThrow(id);
    return this.prisma.ccContact.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.email !== undefined && { email: dto.email.trim().toLowerCase() }),
      },
      select: { id: true, name: true, email: true },
    });
  }

  /** Elimina un contacto CC (admin). */
  async remove(id: string) {
    await this.getOrThrow(id);
    await this.prisma.ccContact.delete({ where: { id } });
  }

  private async getOrThrow(id: string) {
    const contact = await this.prisma.ccContact.findUnique({ where: { id } });
    if (!contact) throw new NotFoundException('Contacto CC no encontrado');
    return contact;
  }
}
