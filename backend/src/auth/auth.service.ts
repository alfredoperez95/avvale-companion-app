import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export interface JwtPayload {
  sub: string;
  email: string;
}

type Appearance = 'microsoft' | 'fiori';

const MAGIC_LINK_GENERIC_RESPONSE = {
  message:
    'Si existe una cuenta con ese correo y estás registrado en la plataforma, recibirás un enlace para iniciar sesión.',
} as const;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.usersService.create(dto);
    return this.buildTokenResponse(user.id, user.email);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (user.enabled === false) {
      throw new UnauthorizedException('Usuario deshabilitado. Contacte al administrador.');
    }
    return this.buildTokenResponse(user.id, user.email);
  }

  async validateUserById(userId: string) {
    return this.usersService.findById(userId);
  }

  async updateProfile(
    userId: string,
    dto: {
      name?: string;
      lastName?: string;
      position?: string;
      phone?: string;
      appearance?: string | null;
      launcherTileOrder?: string[];
    },
  ) {
    const user = await this.usersService.updateProfile(userId, dto);
    if (!user) return null;
    const { passwordHash: _, ...rest } = user;
    return rest;
  }

  async setAvatar(userId: string, file: { buffer: Buffer; mimetype?: string }) {
    return this.usersService.setAvatar(userId, file);
  }

  async getAvatarBuffer(userId: string) {
    return this.usersService.getAvatarBuffer(userId);
  }

  async removeAvatar(userId: string) {
    return this.usersService.removeAvatar(userId);
  }

  getLoginBranding() {
    const rawAppearance = (process.env.LOGIN_APPEARANCE ?? process.env.DEFAULT_APPEARANCE ?? 'microsoft')
      .toLowerCase()
      .trim();
    const appearance: Appearance = rawAppearance === 'fiori' ? 'fiori' : 'microsoft';
    return { appearance };
  }

  /**
   * Solicita enlace mágico. Respuesta siempre idéntica (anti enumeración de cuentas).
   */
  async requestMagicLink(emailRaw: string): Promise<typeof MAGIC_LINK_GENERIC_RESPONSE> {
    const email = emailRaw.trim().toLowerCase();
    const user = await this.usersService.findByEmail(email);

    if (!user || user.enabled === false) {
      return MAGIC_LINK_GENERIC_RESPONSE;
    }

    const secret =
      this.config.get<string>('MAGIC_LINK_SECRET')?.trim() ||
      this.config.get<string>('JWT_SECRET')?.trim() ||
      'change-me-in-production';
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(`${secret}:${rawToken}`).digest('hex');

    const ttlMin = parseInt(this.config.get<string>('MAGIC_LINK_TTL_MINUTES') ?? '15', 10);
    const expiresAt = new Date(Date.now() + ttlMin * 60_000);

    await this.prisma.magicLoginToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    const baseUrl =
      this.config.get<string>('MAGIC_LINK_BASE_URL')?.trim() ||
      'http://localhost:3000/login/magic';
    const magicUrl = `${baseUrl.replace(/\/$/, '')}?token=${encodeURIComponent(rawToken)}`;

    await this.prisma.magicLoginToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    try {
      await this.mailService.sendMagicLinkEmail(user.email, magicUrl);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Enlace mágico no enviado a ${user.email}: ${detail}. ` +
          `Comprobar en el backend: MAIL_SKIP_SEND=false (o ausente), SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS, ` +
          `MAGIC_LINK_BASE_URL=https://…/login/magic. La API sigue respondiendo 200 con mensaje genérico por diseño.`,
      );
      await this.prisma.magicLoginToken.deleteMany({ where: { tokenHash } });
    }

    return MAGIC_LINK_GENERIC_RESPONSE;
  }

  async verifyMagicLink(tokenRaw: string) {
    const token = tokenRaw.trim();
    if (!token) {
      throw new UnauthorizedException('Enlace inválido o caducado');
    }

    const secret =
      this.config.get<string>('MAGIC_LINK_SECRET')?.trim() ||
      this.config.get<string>('JWT_SECRET')?.trim() ||
      'change-me-in-production';
    const tokenHash = createHash('sha256').update(`${secret}:${token}`).digest('hex');

    const row = await this.prisma.magicLoginToken.findFirst({
      where: { tokenHash },
      include: { user: true },
    });

    if (!row || row.usedAt != null || row.expiresAt < new Date()) {
      throw new UnauthorizedException('Enlace inválido o caducado');
    }

    if (row.user.enabled === false) {
      throw new UnauthorizedException('Usuario deshabilitado. Contacte al administrador.');
    }

    await this.prisma.magicLoginToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });

    return this.buildTokenResponse(row.user.id, row.user.email);
  }

  private buildTokenResponse(userId: string, email: string) {
    const payload: JwtPayload = { sub: userId, email };
    const accessToken = this.jwtService.sign(payload);
    return { accessToken, user: { id: userId, email } };
  }
}
