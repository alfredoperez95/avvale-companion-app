import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBillingAdminContactDto } from './dto/create-billing-admin-contact.dto';
import { UpdateBillingAdminContactDto } from './dto/update-billing-admin-contact.dto';

@Injectable()
export class BillingAdminContactsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista contactos ordenados por nombre (id, name, email). */
  findAll() {
    return this.prisma.billingAdminContact.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true },
    });
  }

  /** Lista solo los emails (para merge en activaciones). */
  async findAllEmails(): Promise<string[]> {
    const contacts = await this.prisma.billingAdminContact.findMany({
      select: { email: true },
    });
    return contacts
      .map((c) => c.email?.trim().toLowerCase())
      .filter((e): e is string => Boolean(e));
  }

  /** Crea un contacto (admin). */
  create(dto: CreateBillingAdminContactDto) {
    return this.prisma.billingAdminContact.create({
      data: {
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
      },
      select: { id: true, name: true, email: true },
    });
  }

  /** Actualiza un contacto (admin). */
  async update(id: string, dto: UpdateBillingAdminContactDto) {
    await this.getOrThrow(id);
    return this.prisma.billingAdminContact.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.email !== undefined && { email: dto.email.trim().toLowerCase() }),
      },
      select: { id: true, name: true, email: true },
    });
  }

  /** Elimina un contacto (admin). */
  async remove(id: string) {
    await this.getOrThrow(id);
    await this.prisma.billingAdminContact.delete({ where: { id } });
  }

  private async getOrThrow(id: string) {
    const contact = await this.prisma.billingAdminContact.findUnique({ where: { id } });
    if (!contact) throw new NotFoundException('Contacto no encontrado');
    return contact;
  }
}
