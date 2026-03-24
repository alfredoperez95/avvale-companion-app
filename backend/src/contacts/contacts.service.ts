import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista contactos ordenados por nombre (id, name, email, isProjectJp). */
  findAll() {
    return this.prisma.ccContact.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true, isProjectJp: true },
    });
  }

  /** Crea un contacto (admin). */
  create(dto: CreateContactDto) {
    return this.prisma.ccContact.create({
      data: {
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        isProjectJp: dto.isProjectJp ?? false,
      },
      select: { id: true, name: true, email: true, isProjectJp: true },
    });
  }

  /** Actualiza un contacto (admin). */
  async update(id: string, dto: UpdateContactDto) {
    await this.getOrThrow(id);
    return this.prisma.ccContact.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.email !== undefined && { email: dto.email.trim().toLowerCase() }),
        ...(dto.isProjectJp !== undefined && { isProjectJp: dto.isProjectJp }),
      },
      select: { id: true, name: true, email: true, isProjectJp: true },
    });
  }

  /** Elimina un contacto (admin). */
  async remove(id: string) {
    await this.getOrThrow(id);
    await this.prisma.ccContact.delete({ where: { id } });
  }

  private async getOrThrow(id: string) {
    const contact = await this.prisma.ccContact.findUnique({ where: { id } });
    if (!contact) throw new NotFoundException('Contacto no encontrado');
    return contact;
  }
}
