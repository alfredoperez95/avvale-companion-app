import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';
import { CreateSubAreaDto } from './dto/create-sub-area.dto';
import { UpdateSubAreaDto } from './dto/update-sub-area.dto';
import { CreateSubAreaContactDto } from './dto/create-sub-area-contact.dto';
import { UpdateSubAreaContactDto } from './dto/update-sub-area-contact.dto';

@Injectable()
export class AreasService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista todas las áreas. Con withDetails=true devuelve áreas con director, subáreas y contactos (admin). Con withSubareas=true solo id+name de áreas y subáreas (para formulario activaciones). */
  async findAll(withDetails: boolean, withSubareas = false) {
    return this.prisma.area.findMany({
      orderBy: { name: 'asc' },
      include:
        withDetails
          ? {
              subAreas: {
                orderBy: { name: 'asc' },
                include: {
                  contacts: { orderBy: [{ isProjectJp: 'desc' }, { name: 'asc' }] },
                },
              },
            }
          : withSubareas
            ? {
                subAreas: {
                  orderBy: { name: 'asc' },
                  select: { id: true, name: true },
                },
              }
            : undefined,
    });
  }

  /** Crea un área (admin). */
  async create(dto: CreateAreaDto) {
    return this.prisma.area.create({
      data: {
        name: dto.name.trim(),
        directorName: dto.directorName?.trim() ?? null,
        directorEmail: dto.directorEmail?.trim().toLowerCase() ?? null,
      },
    });
  }

  /** Actualiza un área (admin). */
  async update(id: string, dto: UpdateAreaDto) {
    await this.getAreaOrThrow(id);
    const data: { name?: string; directorName?: string | null; directorEmail?: string | null } = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.directorName !== undefined) data.directorName = dto.directorName?.trim() ?? null;
    if (dto.directorEmail !== undefined) data.directorEmail = dto.directorEmail?.trim().toLowerCase() ?? null;
    return this.prisma.area.update({
      where: { id },
      data,
    });
  }

  /** Elimina un área, sus subáreas y contactos (admin). */
  async remove(id: string) {
    await this.getAreaOrThrow(id);
    await this.prisma.area.delete({ where: { id } });
  }

  /** Lista subáreas de un área (admin). */
  async findSubAreasByAreaId(areaId: string) {
    await this.getAreaOrThrow(areaId);
    return this.prisma.subArea.findMany({
      where: { areaId },
      orderBy: { name: 'asc' },
      include: { contacts: { orderBy: [{ isProjectJp: 'desc' }, { name: 'asc' }] } },
    });
  }

  /** Crea una subárea en un área (admin). */
  async createSubArea(areaId: string, dto: CreateSubAreaDto) {
    await this.getAreaOrThrow(areaId);
    return this.prisma.subArea.create({
      data: { areaId, name: dto.name.trim() },
    });
  }

  /** Actualiza una subárea (admin). */
  async updateSubArea(subAreaId: string, dto: UpdateSubAreaDto) {
    await this.getSubAreaOrThrow(subAreaId);
    return this.prisma.subArea.update({
      where: { id: subAreaId },
      data: dto.name !== undefined ? { name: dto.name.trim() } : {},
    });
  }

  /** Elimina una subárea y sus contactos (admin). */
  async removeSubArea(subAreaId: string) {
    await this.getSubAreaOrThrow(subAreaId);
    await this.prisma.subArea.delete({ where: { id: subAreaId } });
  }

  /** Lista contactos de una subárea (admin). */
  async findContactsBySubAreaId(subAreaId: string) {
    await this.getSubAreaOrThrow(subAreaId);
    return this.prisma.subAreaContact.findMany({
      where: { subAreaId },
      orderBy: { name: 'asc' },
    });
  }

  /** Añade un contacto a una subárea (admin). */
  async addSubAreaContact(subAreaId: string, dto: CreateSubAreaContactDto) {
    await this.getSubAreaOrThrow(subAreaId);
    return this.prisma.subAreaContact.create({
      data: {
        subAreaId,
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        isProjectJp: dto.isProjectJp ?? false,
      },
    });
  }

  /** Actualiza un contacto de subárea (admin). */
  async updateSubAreaContact(contactId: string, dto: UpdateSubAreaContactDto) {
    const contact = await this.prisma.subAreaContact.findFirst({ where: { id: contactId } });
    if (!contact) throw new NotFoundException('Contacto no encontrado');
    const data: { name?: string; email?: string; isProjectJp?: boolean } = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.email !== undefined) data.email = dto.email.trim().toLowerCase();
    if (dto.isProjectJp !== undefined) data.isProjectJp = dto.isProjectJp;
    return this.prisma.subAreaContact.update({
      where: { id: contactId },
      data,
    });
  }

  /** Elimina un contacto de subárea (admin). */
  async removeSubAreaContact(contactId: string) {
    const contact = await this.prisma.subAreaContact.findFirst({ where: { id: contactId } });
    if (!contact) throw new NotFoundException('Contacto no encontrado');
    await this.prisma.subAreaContact.delete({ where: { id: contactId } });
  }

  private async getAreaOrThrow(id: string) {
    const area = await this.prisma.area.findUnique({ where: { id } });
    if (!area) throw new NotFoundException('Área no encontrada');
    return area;
  }

  private async getSubAreaOrThrow(id: string) {
    const subArea = await this.prisma.subArea.findUnique({ where: { id } });
    if (!subArea) throw new NotFoundException('Subárea no encontrada');
    return subArea;
  }
}
