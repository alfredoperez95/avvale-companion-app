import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { RegisterDto } from '../auth/dto/register.dto';
import { UserIndustry, UserPosition, UserRole } from '@prisma/client';
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

  /** Solo una persona puede tener GROWTH_MANAGING_DIRECTOR; `excludeUserId` es quien ya ocupa el puesto (p. ej. al editarse a sí mismo). */
  async assertGrowthManagingDirectorAvailable(
    position: UserPosition | null | undefined,
    excludeUserId: string | null,
  ): Promise<void> {
    if (position !== UserPosition.GROWTH_MANAGING_DIRECTOR) return;
    const holder = await this.prisma.user.findFirst({
      where: { position: UserPosition.GROWTH_MANAGING_DIRECTOR },
      select: { id: true },
    });
    if (!holder) return;
    if (excludeUserId !== null && holder.id === excludeUserId) return;
    throw new ConflictException(
      'El puesto Growth Managing Director ya está asignado a otra persona.',
    );
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /** Usuario para respuestas API (/auth/me, etc.): sin hash de contraseña e indicador de clave Anthropic. */
  async findByIdForApiResponse(id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      include: { anthropicCredential: { select: { id: true } } },
    });
    if (!u) return null;
    const growthHolder = await this.prisma.user.findFirst({
      where: { position: UserPosition.GROWTH_MANAGING_DIRECTOR },
      select: { id: true },
    });
    const { passwordHash: _, anthropicCredential, ...rest } = u;
    return {
      ...rest,
      hasAnthropicApiKey: Boolean(anthropicCredential),
      growthManagingDirectorUserId: growthHolder?.id ?? null,
    };
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      orderBy: [{ createdAt: 'desc' }],
      include: {
        anthropicCredential: { select: { id: true } },
      },
    });
    return users.map((u) => {
      const { passwordHash: _, anthropicCredential, ...rest } = u;
      return {
        ...rest,
        hasAnthropicApiKey: Boolean(anthropicCredential),
      };
    });
  }

  async updateProfile(
    userId: string,
    data: {
      name?: string;
      lastName?: string;
      position?: UserPosition;
      industry?: UserIndustry | null;
      phone?: string;
      appearance?: string | null;
      launcherTileOrder?: string[];
    },
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
    const normalizedPosition = data.position;
    const normalizedPhone =
      data.phone !== undefined ? (data.phone.trim() === '' ? null : data.phone.trim()) : undefined;

    if (
      hasAllProfileFields &&
      (!normalizedName || !normalizedLastName || normalizedPosition === undefined)
    ) {
      throw new BadRequestException('Nombre, apellidos y puesto son obligatorios');
    }

    if (data.position !== undefined) {
      await this.assertGrowthManagingDirectorAvailable(normalizedPosition ?? null, userId);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined && { name: normalizedName }),
        ...(data.lastName !== undefined && { lastName: normalizedLastName }),
        ...(data.position !== undefined && { position: normalizedPosition }),
        ...(data.industry !== undefined && { industry: data.industry }),
        ...(data.phone !== undefined && { phone: normalizedPhone }),
        ...(data.appearance !== undefined && { appearance: data.appearance || null }),
        ...(data.launcherTileOrder !== undefined && {
          launcherTileOrder: data.launcherTileOrder,
        }),
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
        appearance: 'fiori',
      },
    });
  }

  async createByAdmin(dto: CreateUserByAdminDto) {
    const existing = await this.findByEmail(dto.email);
    if (existing) throw new ConflictException('El email ya está registrado');
    const name = dto.name.trim();
    const lastName = dto.lastName.trim();
    const position = dto.position;
    if (!name || !lastName || !position) {
      throw new BadRequestException('Nombre, apellidos y puesto son obligatorios');
    }
    await this.assertGrowthManagingDirectorAvailable(position, null);

    const passwordHash = await bcrypt.hash(dto.password, this.SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        name,
        lastName,
        position,
        ...(dto.industry !== undefined && { industry: dto.industry }),
        passwordHash,
        role: dto.role ?? UserRole.USER,
        appearance: 'fiori',
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
    const data: {
      name?: string;
      lastName?: string;
      email?: string;
      position?: UserPosition | null;
      industry?: UserIndustry | null;
      role?: UserRole;
      enabled?: boolean;
      passwordHash?: string;
    } = {};
    if (dto.name !== undefined || dto.lastName !== undefined) {
      const name = (dto.name ?? existing.name ?? '').trim();
      const lastName = (dto.lastName ?? existing.lastName ?? '').trim();
      if (!name || !lastName) {
        throw new BadRequestException('Nombre y apellido son obligatorios');
      }
      data.name = name;
      data.lastName = lastName;
    }
    if (dto.email !== undefined && dto.email.trim() !== '') {
      const normalizedEmail = dto.email.toLowerCase().trim();
      const other = await this.findByEmail(normalizedEmail);
      if (other && other.id !== id) throw new ConflictException('El correo electrónico ya está en uso');
      data.email = normalizedEmail;
    }
    if (dto.position !== undefined) data.position = dto.position;
    if (dto.industry !== undefined) data.industry = dto.industry;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.newPassword !== undefined && dto.newPassword.length > 0) {
      data.passwordHash = await bcrypt.hash(dto.newPassword, this.SALT_ROUNDS);
    }
    if (dto.position !== undefined) {
      await this.assertGrowthManagingDirectorAvailable(dto.position, id);
    }
    const user = await this.prisma.user.update({
      where: { id },
      data,
    });
    return this.omitPasswordHash(user);
  }

  /** Elimina un usuario y datos relacionados (cascada en BD). No permite borrar el propio usuario ni al único administrador. */
  async deleteByAdmin(id: string, actingAdminId: string): Promise<void> {
    if (id === actingAdminId) {
      throw new BadRequestException('No puedes eliminar tu propio usuario.');
    }
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Usuario no encontrado');
    if (existing.role === UserRole.ADMIN) {
      const adminCount = await this.prisma.user.count({ where: { role: UserRole.ADMIN } });
      if (adminCount <= 1) {
        throw new BadRequestException('No se puede eliminar el único administrador del sistema.');
      }
    }
    await this.removeAvatar(id).catch(() => {});
    await this.prisma.user.delete({ where: { id } });
  }
}
