import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Area, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UserPayload } from '../auth/decorators/user-payload';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';
import { CreateSubAreaDto } from './dto/create-sub-area.dto';
import { UpdateSubAreaDto } from './dto/update-sub-area.dto';
import { CreateSubAreaContactDto } from './dto/create-sub-area-contact.dto';
import { UpdateSubAreaContactDto } from './dto/update-sub-area-contact.dto';

@Injectable()
export class AreasService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * admin=true: solo ADMIN — árbol enriquecido del catálogo sistema (ownerUserId null).
   * withSubareas=true: catálogo sistema para formulario de activaciones (todos los usuarios).
   * Sin flags: lista plana del catálogo sistema (misma visibilidad que withSubareas en práctica).
   */
  async findAll(user: UserPayload, withDetails: boolean, withSubareas: boolean) {
    if (withDetails && user.role !== 'ADMIN') {
      throw new ForbiddenException('Solo los administradores pueden gestionar el catálogo de áreas');
    }

    const include =
      withDetails
        ? {
            subAreas: {
              orderBy: { name: Prisma.SortOrder.asc },
              include: {
                contacts: {
                  orderBy: [{ isProjectJp: Prisma.SortOrder.desc }, { name: Prisma.SortOrder.asc }],
                },
              },
            },
          }
        : withSubareas
          ? {
              subAreas: {
                orderBy: { name: Prisma.SortOrder.asc },
                select: { id: true, name: true },
              },
            }
          : undefined;

    if (withSubareas) {
      return this.prisma.area.findMany({
        where: { ownerUserId: null },
        orderBy: { name: Prisma.SortOrder.asc },
        include,
      });
    }

    if (withDetails) {
      return this.prisma.area.findMany({
        where: { ownerUserId: null },
        orderBy: { name: Prisma.SortOrder.asc },
        include,
      });
    }

    return this.prisma.area.findMany({
      where: { ownerUserId: null },
      orderBy: { name: Prisma.SortOrder.asc },
    });
  }

  /** Solo ADMIN: crea área en catálogo sistema. */
  async create(user: UserPayload, dto: CreateAreaDto) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Solo los administradores pueden crear áreas');
    }
    return this.prisma.area.create({
      data: {
        name: dto.name.trim(),
        directorName: dto.directorName?.trim() ?? null,
        directorEmail: dto.directorEmail?.trim().toLowerCase() ?? null,
        ownerUserId: null,
      },
    });
  }

  async update(user: UserPayload, id: string, dto: UpdateAreaDto) {
    await this.getAreaForMutation(id, user);
    const data: { name?: string; directorName?: string | null; directorEmail?: string | null } = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.directorName !== undefined) data.directorName = dto.directorName?.trim() ?? null;
    if (dto.directorEmail !== undefined) data.directorEmail = dto.directorEmail?.trim().toLowerCase() ?? null;
    return this.prisma.area.update({
      where: { id },
      data,
    });
  }

  async remove(user: UserPayload, id: string) {
    await this.getAreaForMutation(id, user);
    await this.prisma.area.delete({ where: { id } });
  }

  async findSubAreasByAreaId(user: UserPayload, areaId: string) {
    await this.getAreaForMutation(areaId, user);
    return this.prisma.subArea.findMany({
      where: { areaId },
      orderBy: { name: Prisma.SortOrder.asc },
      include: {
        contacts: {
          orderBy: [{ isProjectJp: Prisma.SortOrder.desc }, { name: Prisma.SortOrder.asc }],
        },
      },
    });
  }

  async createSubArea(user: UserPayload, areaId: string, dto: CreateSubAreaDto) {
    await this.getAreaForMutation(areaId, user);
    return this.prisma.subArea.create({
      data: { areaId, name: dto.name.trim() },
    });
  }

  async updateSubArea(user: UserPayload, subAreaId: string, dto: UpdateSubAreaDto) {
    await this.getSubAreaForMutation(subAreaId, user);
    return this.prisma.subArea.update({
      where: { id: subAreaId },
      data: dto.name !== undefined ? { name: dto.name.trim() } : {},
    });
  }

  async removeSubArea(user: UserPayload, subAreaId: string) {
    await this.getSubAreaForMutation(subAreaId, user);
    await this.prisma.subArea.delete({ where: { id: subAreaId } });
  }

  async findContactsBySubAreaId(user: UserPayload, subAreaId: string) {
    await this.getSubAreaForMutation(subAreaId, user);
    return this.prisma.subAreaContact.findMany({
      where: { subAreaId },
      orderBy: { name: Prisma.SortOrder.asc },
    });
  }

  async findSubAreasByContactEmail(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return [];
    const contacts = await this.prisma.subAreaContact.findMany({
      where: {
        email: normalizedEmail,
        subArea: {
          area: {
            ownerUserId: null,
          },
        },
      },
      select: {
        subArea: {
          select: {
            id: true,
            name: true,
            area: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [{ subArea: { area: { name: 'asc' } } }, { subArea: { name: 'asc' } }],
    });

    const unique = new Map<string, { subAreaId: string; subAreaName: string; areaId: string; areaName: string }>();
    for (const row of contacts) {
      unique.set(row.subArea.id, {
        subAreaId: row.subArea.id,
        subAreaName: row.subArea.name,
        areaId: row.subArea.area.id,
        areaName: row.subArea.area.name,
      });
    }
    return [...unique.values()];
  }

  async addSubAreaContact(user: UserPayload, subAreaId: string, dto: CreateSubAreaContactDto) {
    await this.getSubAreaForMutation(subAreaId, user);
    return this.prisma.subAreaContact.create({
      data: {
        subAreaId,
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        isProjectJp: dto.isProjectJp ?? false,
      },
    });
  }

  async updateSubAreaContact(user: UserPayload, contactId: string, dto: UpdateSubAreaContactDto) {
    const contact = await this.prisma.subAreaContact.findFirst({
      where: { id: contactId },
      include: { subArea: { include: { area: true } } },
    });
    if (!contact) throw new NotFoundException('Contacto no encontrado');
    this.assertAreaMutableBy(contact.subArea.area as Area, user);
    const data: { name?: string; email?: string; isProjectJp?: boolean } = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.email !== undefined) data.email = dto.email.trim().toLowerCase();
    if (dto.isProjectJp !== undefined) data.isProjectJp = dto.isProjectJp;
    return this.prisma.subAreaContact.update({
      where: { id: contactId },
      data,
    });
  }

  async removeSubAreaContact(user: UserPayload, contactId: string) {
    const contact = await this.prisma.subAreaContact.findFirst({
      where: { id: contactId },
      include: { subArea: { include: { area: true } } },
    });
    if (!contact) throw new NotFoundException('Contacto no encontrado');
    this.assertAreaMutableBy(contact.subArea.area as Area, user);
    await this.prisma.subAreaContact.delete({ where: { id: contactId } });
  }

  private assertAreaMutableBy(area: Pick<Area, 'ownerUserId'>, user: UserPayload) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Solo los administradores pueden modificar áreas');
    }
    if (area.ownerUserId !== null) {
      throw new ForbiddenException('Solo se puede gestionar el catálogo de áreas global');
    }
  }

  private async getAreaForMutation(id: string, user: UserPayload) {
    const area = await this.prisma.area.findUnique({ where: { id } });
    if (!area) throw new NotFoundException('Área no encontrada');
    this.assertAreaMutableBy(area, user);
    return area;
  }

  private async getSubAreaForMutation(id: string, user: UserPayload) {
    const subArea = await this.prisma.subArea.findUnique({
      where: { id },
      include: { area: true },
    });
    if (!subArea) throw new NotFoundException('Subárea no encontrada');
    this.assertAreaMutableBy(subArea.area, user);
    return subArea;
  }
}
