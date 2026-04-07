import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { UserIndustry, UserPosition, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { InviteUserDto } from './dto/invite-user.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { getAppPublicUrl } from '../rfq-analysis/rfq-analysis.config';

const SALT_ROUNDS = 10;

/** Al reenviar desde admin, el enlace vuelve a estar vigente 24 horas. */
export const INVITE_RESEND_TTL_HOURS = 24;

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  private resolveInviteSecret(): string {
    return (
      this.config.get<string>('INVITE_TOKEN_SECRET')?.trim() ||
      this.config.get<string>('MAGIC_LINK_SECRET')?.trim() ||
      this.config.get<string>('JWT_SECRET')?.trim() ||
      'change-me-in-production'
    );
  }

  private hashToken(rawToken: string): string {
    const secret = this.resolveInviteSecret();
    return createHash('sha256').update(`${secret}:${rawToken}`).digest('hex');
  }

  private inviteTtlMs(): number {
    const hours = parseInt(this.config.get<string>('INVITE_REGISTRATION_TTL_HOURS') ?? '168', 10);
    return hours * 60 * 60 * 1000;
  }

  private buildInviteUrl(rawToken: string): string {
    const appPublicUrl = getAppPublicUrl(this.config);
    const base =
      this.config.get<string>('INVITE_REGISTRATION_BASE_URL')?.trim() ||
      `${appPublicUrl}/login/register-invite`;
    return `${base.replace(/\/$/, '')}?token=${encodeURIComponent(rawToken)}`;
  }

  async createAndSendInvite(dto: InviteUserDto, invitedByUserId: string): Promise<{ ok: true; email: string }> {
    const email = dto.email.trim().toLowerCase();
    const name = dto.name.trim();
    const lastName = dto.lastName.trim();
    if (!name || !lastName) {
      throw new BadRequestException('Nombre y apellidos son obligatorios');
    }

    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Ya existe un usuario con ese correo electrónico.');
    }

    const position = dto.position ?? undefined;
    if (position !== undefined) {
      await this.usersService.assertGrowthManagingDirectorAvailable(position, null);
    }

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + this.inviteTtlMs());
    const role = dto.role ?? UserRole.USER;

    const row = await this.prisma.userInvitation.upsert({
      where: { email },
      create: {
        email,
        name,
        lastName,
        position: dto.position ?? null,
        industry: dto.industry ?? null,
        role,
        tokenHash,
        invitedByUserId,
        expiresAt,
      },
      update: {
        name,
        lastName,
        position: dto.position ?? null,
        industry: dto.industry ?? null,
        role,
        tokenHash,
        invitedByUserId,
        expiresAt,
        usedAt: null,
      },
    });

    const inviteUrl = this.buildInviteUrl(rawToken);
    try {
      const ttlHours = Math.round(this.inviteTtlMs() / (60 * 60 * 1000));
      await this.mailService.sendInvitationRegistrationEmail(email, inviteUrl, { name, lastName, ttlHours });
    } catch (err) {
      await this.prisma.userInvitation.delete({ where: { id: row.id } }).catch(() => {});
      throw err;
    }

    return { ok: true, email };
  }

  async getPreviewByToken(tokenRaw: string) {
    const token = tokenRaw?.trim();
    if (!token) {
      throw new NotFoundException();
    }
    const tokenHash = this.hashToken(token);
    const now = new Date();
    const row = await this.prisma.userInvitation.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
    });
    if (!row) {
      throw new NotFoundException();
    }

    const growthHolder = await this.prisma.user.findFirst({
      where: { position: UserPosition.GROWTH_MANAGING_DIRECTOR },
      select: { id: true },
    });

    return {
      email: row.email,
      name: row.name,
      lastName: row.lastName,
      position: row.position,
      industry: row.industry,
      role: row.role,
      needsPosition: row.position == null,
      needsIndustry: row.industry == null,
      growthManagingDirectorUserId: growthHolder?.id ?? null,
    };
  }

  async acceptInvitation(dto: AcceptInvitationDto) {
    const token = dto.token.trim();
    const tokenHash = this.hashToken(token);
    const now = new Date();

    const inv = await this.prisma.userInvitation.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
    });
    if (!inv) {
      throw new NotFoundException('Invitación no válida o caducada.');
    }

    const finalPosition = inv.position ?? dto.position ?? null;
    if (finalPosition === null) {
      throw new BadRequestException('Selecciona un puesto para completar el registro.');
    }

    await this.usersService.assertGrowthManagingDirectorAvailable(finalPosition, null);

    const industry: UserIndustry | null = inv.industry ?? dto.industry ?? null;
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: inv.email,
          name: inv.name,
          lastName: inv.lastName,
          position: finalPosition,
          industry,
          passwordHash,
          role: inv.role,
          appearance: 'fiori',
        },
      });
      await tx.userInvitation.delete({ where: { id: inv.id } });
      return u;
    });

    return { id: user.id, email: user.email };
  }

  async listForAdmin() {
    const rows = await this.prisma.userInvitation.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        invitedBy: { select: { id: true, email: true, name: true, lastName: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      lastName: r.lastName,
      position: r.position,
      industry: r.industry,
      role: r.role,
      expiresAt: r.expiresAt.toISOString(),
      usedAt: r.usedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      invitedBy: r.invitedBy,
    }));
  }

  async deleteByAdmin(id: string): Promise<void> {
    const row = await this.prisma.userInvitation.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Invitación no encontrada');
    await this.prisma.userInvitation.delete({ where: { id } });
  }

  /**
   * Nuevo token, caducidad +24h desde ahora, correo con texto acorde. Solo si la invitación no fue usada.
   */
  async resendByAdmin(id: string): Promise<{ ok: true }> {
    const inv = await this.prisma.userInvitation.findUnique({ where: { id } });
    if (!inv) throw new NotFoundException('Invitación no encontrada');
    if (inv.usedAt != null) {
      throw new BadRequestException('La invitación ya fue utilizada; no se puede reenviar.');
    }

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + INVITE_RESEND_TTL_HOURS * 60 * 60 * 1000);

    await this.prisma.userInvitation.update({
      where: { id },
      data: { tokenHash, expiresAt },
    });

    const inviteUrl = this.buildInviteUrl(rawToken);
    try {
      await this.mailService.sendInvitationRegistrationEmail(inv.email, inviteUrl, {
        name: inv.name,
        lastName: inv.lastName,
        ttlHours: INVITE_RESEND_TTL_HOURS,
      });
    } catch (err) {
      this.logger.error(`Reenvío invitación ${id}: falló el correo, se revierte token/expiración`);
      await this.prisma.userInvitation
        .update({
          where: { id },
          data: { tokenHash: inv.tokenHash, expiresAt: inv.expiresAt },
        })
        .catch(() => {});
      throw err;
    }

    return { ok: true };
  }
}
