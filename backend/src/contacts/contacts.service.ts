import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  private static readonly ALLOWED_FIELDS = new Set(['name', 'email']);

  /**
   * Lista contactos ordenados por nombre.
   * - Sin `fields` o con `name`+`email`: objetos completos.
   * - Solo `email` o solo `name`: respuesta acotada para integraciones.
   */
  async findAll(fieldsQuery?: string) {
    const tokens =
      fieldsQuery
        ?.split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean) ?? [];

    if (tokens.length > 0) {
      const unknown = tokens.filter((t) => !ContactsService.ALLOWED_FIELDS.has(t));
      if (unknown.length > 0) {
        throw new BadRequestException(
          `Parámetro fields inválido. Use: name, email o name,email (separados por coma).`,
        );
      }
    }

    const wantName = tokens.length === 0 || tokens.includes('name');
    const wantEmail = tokens.length === 0 || tokens.includes('email');

    if (wantName && wantEmail) {
      return this.prisma.ccContact.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, email: true, isProjectJp: true },
      });
    }

    if (wantEmail) {
      const rows = await this.prisma.ccContact.findMany({
        orderBy: { name: 'asc' },
        select: { email: true },
      });
      return { emails: rows.map((r) => r.email) };
    }

    const rows = await this.prisma.ccContact.findMany({
      orderBy: { name: 'asc' },
      select: { name: true },
    });
    return { names: rows.map((r) => r.name) };
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
