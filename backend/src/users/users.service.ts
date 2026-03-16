import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from '../auth/dto/register.dto';
import { UserRole } from '@prisma/client';
import { CreateUserByAdminDto } from './dto/create-user-by-admin.dto';
import { UpdateUserByAdminDto } from './dto/update-user-by-admin.dto';

@Injectable()
export class UsersService {
  private readonly SALT_ROUNDS = 10;

  constructor(private readonly prisma: PrismaService) {}

  private omitPasswordHash<T extends { passwordHash?: string }>(user: T): Omit<T, 'passwordHash'> {
    const { passwordHash: _, ...rest } = user;
    return rest;
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      orderBy: [{ createdAt: 'desc' }],
    });
    return users.map((u) => this.omitPasswordHash(u));
  }

  async updateProfile(
    userId: string,
    data: { name?: string; lastName?: string; position?: string; appearance?: string | null },
  ) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined && { name: data.name || null }),
        ...(data.lastName !== undefined && { lastName: data.lastName || null }),
        ...(data.position !== undefined && { position: data.position || null }),
        ...(data.appearance !== undefined && { appearance: data.appearance || null }),
      },
    });
    return this.findById(userId);
  }

  async create(dto: RegisterDto) {
    const existing = await this.findByEmail(dto.email);
    if (existing) throw new ConflictException('El email ya está registrado');
    const passwordHash = await bcrypt.hash(dto.password, this.SALT_ROUNDS);
    return this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        name: dto.name ?? null,
        passwordHash,
        role: UserRole.USER,
      },
    });
  }

  async createByAdmin(dto: CreateUserByAdminDto) {
    const existing = await this.findByEmail(dto.email);
    if (existing) throw new ConflictException('El email ya está registrado');
    const passwordHash = await bcrypt.hash(dto.password, this.SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        name: dto.name ?? null,
        lastName: dto.lastName ?? null,
        passwordHash,
        role: dto.role ?? UserRole.USER,
      },
    });
    return this.omitPasswordHash(user);
  }

  async updateByAdmin(id: string, dto: UpdateUserByAdminDto) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Usuario no encontrado');
    const data: { email?: string; position?: string | null; role?: UserRole; enabled?: boolean; passwordHash?: string } = {};
    if (dto.email !== undefined && dto.email.trim() !== '') {
      const normalizedEmail = dto.email.toLowerCase().trim();
      const other = await this.findByEmail(normalizedEmail);
      if (other && other.id !== id) throw new ConflictException('El correo electrónico ya está en uso');
      data.email = normalizedEmail;
    }
    if (dto.position !== undefined) data.position = dto.position.trim() || null;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.newPassword !== undefined && dto.newPassword.length > 0) {
      data.passwordHash = await bcrypt.hash(dto.newPassword, this.SALT_ROUNDS);
    }
    const user = await this.prisma.user.update({
      where: { id },
      data,
    });
    return this.omitPasswordHash(user);
  }
}
