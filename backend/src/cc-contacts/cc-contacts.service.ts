import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
}
