import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { RegisterDto } from '../auth/dto/register.dto';
import { UserRole } from '@prisma/client';
import { CreateUserByAdminDto } from './dto/create-user-by-admin.dto';
import { UpdateUserByAdminDto } from './dto/update-user-by-admin.dto';

const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const AVATAR_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

@Injectable()
export class UsersService {
  private readonly SALT_ROUNDS = 10;
  private readonly uploadsDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.uploadsDir = this.config.get<string>('ATTACHMENTS_DIR') ?? path.join(process.cwd(), 'uploads');
  }

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
    data: { name?: string; lastName?: string; position?: string; phone?: string; appearance?: string | null },
  ) {
    const hasAnyProfileField =
      data.name !== undefined || data.lastName !== undefined || data.position !== undefined;
    const hasAllProfileFields =
      data.name !== undefined && data.lastName !== undefined && data.position !== undefined;

    if (hasAnyProfileField && !hasAllProfileFields) {
      throw new BadRequestException('Nombre, apellidos y puesto son obligatorios');
    }

    const normalizedName = data.name?.trim();
    const normalizedLastName = data.lastName?.trim();
    const normalizedPosition = data.position?.trim();
    const normalizedPhone =
      data.phone !== undefined ? (data.phone.trim() === '' ? null : data.phone.trim()) : undefined;

    if (
      hasAllProfileFields &&
      (!normalizedName || !normalizedLastName || !normalizedPosition)
    ) {
      throw new BadRequestException('Nombre, apellidos y puesto son obligatorios');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined && { name: normalizedName }),
        ...(data.lastName !== undefined && { lastName: normalizedLastName }),
        ...(data.position !== undefined && { position: normalizedPosition }),
        ...(data.phone !== undefined && { phone: normalizedPhone }),
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
    const name = dto.name.trim();
    const lastName = dto.lastName.trim();
    const position = dto.position.trim();
    if (!name || !lastName || !position) {
      throw new BadRequestException('Nombre, apellidos y puesto son obligatorios');
    }
    const passwordHash = await bcrypt.hash(dto.password, this.SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        name,
        lastName,
        position,
        passwordHash,
        role: dto.role ?? UserRole.USER,
      },
    });
    return this.omitPasswordHash(user);
  }

  private getAvatarDir(): string {
    return path.join(this.uploadsDir, 'avatars');
  }

  private isPublicAvatarPath(avatarPath: string): boolean {
    return avatarPath.replace(/\\/g, '/').startsWith('resources/avatar/');
  }

  private getAvatarFullPath(avatarPath: string): string {
    if (this.isPublicAvatarPath(avatarPath)) {
      // Compatibilidad con un formato anterior que guardó avatares en el frontend (/public).
      // Mantener lectura/borrado, pero los nuevos avatares se guardan en uploads (privado).
      return path.resolve(process.cwd(), '..', 'frontend', 'public', 'resources', 'avatar', path.basename(avatarPath));
    }
    return path.join(this.uploadsDir, avatarPath);
  }

  private getExtensionFromMime(mimetype: string): string {
    const m = mimetype?.split(';')[0].trim().toLowerCase();
    if (m === 'image/jpeg' || m === 'image/jpg') return '.jpg';
    if (m === 'image/png') return '.png';
    if (m === 'image/webp') return '.webp';
    if (m === 'image/gif') return '.gif';
    return '.jpg';
  }

  async setAvatar(userId: string, file: { buffer: Buffer; mimetype?: string }): Promise<{ avatarPath: string }> {
    if (!file.buffer || file.buffer.length > AVATAR_MAX_BYTES) {
      throw new BadRequestException('Imagen no válida o demasiado grande (máx. 2 MB)');
    }
    const mime = file.mimetype?.split(';')[0].trim().toLowerCase();
    if (!mime || !AVATAR_MIMES.includes(mime)) {
      throw new BadRequestException('Formato no permitido. Use JPEG, PNG, WebP o GIF.');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const avatarDir = this.getAvatarDir();
    await fs.mkdir(avatarDir, { recursive: true });
    const ext = this.getExtensionFromMime(mime);
    const fileName = `${userId}${ext}`;
    const fullPath = path.join(avatarDir, fileName);

    if (user.avatarPath) {
      const oldPath = this.getAvatarFullPath(user.avatarPath);
      await fs.unlink(oldPath).catch(() => {});
    }

    await fs.writeFile(fullPath, file.buffer);
    const storedPath = path.join('avatars', fileName);
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarPath: storedPath },
    });
    return { avatarPath: storedPath };
  }

  async getAvatarBuffer(userId: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { avatarPath: true } });
    if (!user?.avatarPath) return null;
    const fullPath = this.getAvatarFullPath(user.avatarPath);
    try {
      const buffer = await fs.readFile(fullPath);
      const ext = path.extname(user.avatarPath).toLowerCase();
      const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
      return { buffer, contentType };
    } catch {
      return null;
    }
  }

  /** Elimina la imagen de perfil del disco y pone avatarPath a null. */
  async removeAvatar(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { avatarPath: true } });
    if (user?.avatarPath) {
      const fullPath = this.getAvatarFullPath(user.avatarPath);
      await fs.unlink(fullPath).catch(() => {});
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarPath: null },
    });
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
