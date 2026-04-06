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

/** Misma cadena y orden que generación/verificación del hash del enlace mágico (no exponer valores). */
type MagicLinkSecretSource = 'MAGIC_LINK_SECRET' | 'JWT_SECRET' | 'fallback_default';

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
   * Secreto para SHA-256 del token mágico: `MAGIC_LINK_SECRET` si existe, si no `JWT_SECRET`, si no fallback fijo.
   * Generación y verificación deben usar la misma resolución; si en producción rotan secretos entre request y verify → `not_found`.
   * `requestMagicLink` borra antes otros tokens no usados del mismo usuario (`deleteMany` usedAt null); un segundo enlace invalida el primero.
   * Tanto request como verify usan el mismo `PrismaService` / `DATABASE_URL` del proceso (no hay segunda base en código).
   */
  private resolveMagicLinkSecret(): { secret: string; source: MagicLinkSecretSource } {
    const magic = this.config.get<string>('MAGIC_LINK_SECRET')?.trim();
    if (magic) return { secret: magic, source: 'MAGIC_LINK_SECRET' };
    const jwt = this.config.get<string>('JWT_SECRET')?.trim();
    if (jwt) return { secret: jwt, source: 'JWT_SECRET' };
    return { secret: 'change-me-in-production', source: 'fallback_default' };
  }

  /** Solo longitud; en no producción, prefijo/sufijo de 4 chars para correlación sin filtrar el token completo. */
  private magicLinkTokenProbe(token: string): { length: number; preview?: string } {
    const length = token.length;
    if (process.env.NODE_ENV === 'production') {
      return { length };
    }
    if (length < 8) {
      return { length, preview: '(corto)' };
    }
    return { length, preview: `${token.slice(0, 4)}…${token.slice(-4)}` };
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

    const { secret, source: secretSource } = this.resolveMagicLinkSecret();
    this.logger.log(`magic_link request: secretSource=${secretSource} userId=${user.id}`);

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(`${secret}:${rawToken}`).digest('hex');

    const ttlMin = parseInt(this.config.get<string>('MAGIC_LINK_TTL_MINUTES') ?? '15', 10);
    const expiresAt = new Date(Date.now() + ttlMin * 60_000);

    const invalidated = await this.prisma.magicLoginToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });
    this.logger.log(
      `magic_link request: invalidated previous unused rows count=${invalidated.count} userId=${user.id}`,
    );

    const baseUrl =
      this.config.get<string>('MAGIC_LINK_BASE_URL')?.trim() ||
      'http://localhost:3000/login/magic';
    const magicUrl = `${baseUrl.replace(/\/$/, '')}?token=${encodeURIComponent(rawToken)}`;

    const created = await this.prisma.magicLoginToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });
    this.logger.log(
      `magic_link request: token row created rowId=${created.id} userId=${user.id} expiresAt=${expiresAt.toISOString()} ttlMin=${ttlMin}`,
    );

    try {
      await this.mailService.sendMagicLinkEmail(user.email, magicUrl);
      this.logger.log(`magic_link request: sendMagicLinkEmail OK userId=${user.id}`);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Enlace mágico no enviado a ${user.email}: ${detail}. ` +
          `Comprobar en el backend: MAIL_SKIP_SEND=false (o ausente), SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS, ` +
          `MAGIC_LINK_BASE_URL=https://…/login/magic. La API sigue respondiendo 200 con mensaje genérico por diseño.`,
      );
      this.logger.warn(`magic_link request: sendMagicLinkEmail FAILED userId=${user.id} — deleting token row for tokenHash`);
      const removed = await this.prisma.magicLoginToken.deleteMany({ where: { tokenHash } });
      this.logger.warn(`magic_link request: deleted rows after mail failure count=${removed.count} userId=${user.id}`);
    }

    return MAGIC_LINK_GENERIC_RESPONSE;
  }

  async verifyMagicLink(tokenRaw: string) {
    const token = tokenRaw.trim();
    if (!token) {
      this.logger.warn('magic_link verify: reject reason=empty_token');
      throw new UnauthorizedException('Enlace inválido o caducado');
    }

    const { secret, source: secretSource } = this.resolveMagicLinkSecret();
    const probe = this.magicLinkTokenProbe(token);
    this.logger.log(
      `magic_link verify: secretSource=${secretSource} tokenLength=${probe.length}` +
        (probe.preview != null ? ` tokenPreview=${probe.preview}` : ''),
    );

    const tokenHash = createHash('sha256').update(`${secret}:${token}`).digest('hex');

    const row = await this.prisma.magicLoginToken.findFirst({
      where: { tokenHash },
      include: { user: true },
    });

    const now = new Date();

    if (!row) {
      this.logger.warn(
        `magic_link verify: reject reason=not_found (no row for hash; includes wrong token, secret mismatch vs creation, deleted after mail fail, or superseded by newer magic link) secretSource=${secretSource}`,
      );
      throw new UnauthorizedException('Enlace inválido o caducado');
    }

    this.logger.log(
      `magic_link verify: row found rowId=${row.id} userId=${row.userId} usedAt=${row.usedAt?.toISOString() ?? 'null'} expiresAt=${row.expiresAt.toISOString()} now=${now.toISOString()}`,
    );

    if (row.usedAt != null) {
      this.logger.warn(
        `magic_link verify: reject reason=already_used userId=${row.userId} usedAt=${row.usedAt.toISOString()}`,
      );
      throw new UnauthorizedException('Enlace inválido o caducado');
    }

    if (row.expiresAt < now) {
      this.logger.warn(
        `magic_link verify: reject reason=expired userId=${row.userId} expiresAt=${row.expiresAt.toISOString()} now=${now.toISOString()}`,
      );
      throw new UnauthorizedException('Enlace inválido o caducado');
    }

    if (row.user.enabled === false) {
      throw new UnauthorizedException('Usuario deshabilitado. Contacte al administrador.');
    }

    await this.prisma.magicLoginToken.update({
      where: { id: row.id },
      data: { usedAt: now },
    });

    this.logger.log(`magic_link verify: success userId=${row.userId}`);
    return this.buildTokenResponse(row.user.id, row.user.email);
  }

  private buildTokenResponse(userId: string, email: string) {
    const payload: JwtPayload = { sub: userId, email };
    const accessToken = this.jwtService.sign(payload);
    return { accessToken, user: { id: userId, email } };
  }
}
