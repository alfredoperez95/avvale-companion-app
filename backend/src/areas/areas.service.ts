import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';
import { CreateAreaContactDto } from './dto/create-area-contact.dto';
import { UpdateAreaContactDto } from './dto/update-area-contact.dto';

@Injectable()
export class AreasService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista todas las áreas. Con withContacts=true devuelve áreas con sus contactos (para admin). */
  async findAll(withContacts: boolean) {
    return this.prisma.area.findMany({
      orderBy: { name: 'asc' },
      include: withContacts
        ? {
            contacts: { orderBy: { name: 'asc' } },
          }
        : undefined,
    });
  }

  /** Crea un área (admin). */
  async create(dto: CreateAreaDto) {
    return this.prisma.area.create({
      data: { name: dto.name.trim() },
    });
  }

  /** Actualiza un área (admin). */
  async update(id: string, dto: UpdateAreaDto) {
    await this.getAreaOrThrow(id);
    return this.prisma.area.update({
      where: { id },
      data: dto.name !== undefined ? { name: dto.name.trim() } : {},
    });
  }

  /** Elimina un área y sus contactos (admin). */
  async remove(id: string) {
    await this.getAreaOrThrow(id);
    await this.prisma.area.delete({ where: { id } });
  }

  /** Lista contactos de un área (admin). */
  async findContactsByAreaId(areaId: string) {
    await this.getAreaOrThrow(areaId);
    return this.prisma.areaContact.findMany({
      where: { areaId },
      orderBy: { name: 'asc' },
    });
  }

  /** Añade un contacto a un área (admin). */
  async addContact(areaId: string, dto: CreateAreaContactDto) {
    await this.getAreaOrThrow(areaId);
    return this.prisma.areaContact.create({
      data: {
        areaId,
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
      },
    });
  }

  /** Actualiza un contacto (admin). */
  async updateContact(contactId: string, dto: UpdateAreaContactDto) {
    const contact = await this.prisma.areaContact.findFirst({ where: { id: contactId } });
    if (!contact) throw new NotFoundException('Contacto no encontrado');
    const data: { name?: string; email?: string } = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.email !== undefined) data.email = dto.email.trim().toLowerCase();
    return this.prisma.areaContact.update({
      where: { id: contactId },
      data,
    });
  }

  /** Elimina un contacto (admin). */
  async removeContact(contactId: string) {
    const contact = await this.prisma.areaContact.findFirst({ where: { id: contactId } });
    if (!contact) throw new NotFoundException('Contacto no encontrado');
    await this.prisma.areaContact.delete({ where: { id: contactId } });
  }

  private async getAreaOrThrow(id: string) {
    const area = await this.prisma.area.findUnique({ where: { id } });
    if (!area) throw new NotFoundException('Área no encontrada');
    return area;
  }
}
