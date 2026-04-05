import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {
  buildMagicLinkEmailHtml,
  buildMagicLinkEmailText,
  DEFAULT_MAIL_LOGO_URL,
} from './templates/magic-link.email';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Envío transaccional (desde MAIL_FROM, p. ej. no-reply@avvalecompanion.app).
   * Si MAIL_SKIP_SEND=true, solo registra en log (útil en desarrollo sin SMTP).
   */
  async sendMagicLinkEmail(to: string, magicUrl: string): Promise<void> {
    const from = this.config.get<string>('MAIL_FROM')?.trim() || 'no-reply@avvalecompanion.app';
    const fromName = this.config.get<string>('MAIL_FROM_NAME')?.trim() || 'Avvale Companion';
    const skip = this.config.get<string>('MAIL_SKIP_SEND') === 'true';

    if (skip) {
      this.logger.log(`[MAIL_SKIP_SEND] Enlace mágico para ${to}: ${magicUrl}`);
      return;
    }

    const host = this.config.get<string>('SMTP_HOST')?.trim();
    if (!host) {
      this.logger.error('SMTP_HOST no definido; no se puede enviar el correo (usa MAIL_SKIP_SEND=true en local)');
      throw new Error('SMTP no configurado');
    }

    const port = parseInt(this.config.get<string>('SMTP_PORT') ?? '587', 10);
    const secure = this.config.get<string>('SMTP_SECURE') === 'true';
    const user = this.config.get<string>('SMTP_USER')?.trim();
    const pass = this.config.get<string>('SMTP_PASS') ?? '';

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
    });

    const ttlMin = parseInt(this.config.get<string>('MAGIC_LINK_TTL_MINUTES') ?? '15', 10);
    const ttlHint = `El enlace caduca en ${ttlMin} minutos por seguridad.`;
    const logoUrl = this.config.get<string>('MAIL_LOGO_URL')?.trim() || DEFAULT_MAIL_LOGO_URL;
    const productTagline = this.config.get<string>('MAIL_PRODUCT_TAGLINE')?.trim() || 'Activaciones · Avvale';
    const emailOpts = { appName: fromName, ttlHint, logoUrl, productTagline };

    await transporter.sendMail({
      from: `"${fromName}" <${from}>`,
      to,
      subject: 'AVVALE ID® - Iniciar Sesión | Avvale Companion App',
      text: buildMagicLinkEmailText(magicUrl, { appName: fromName, productTagline, ttlHint }),
      html: buildMagicLinkEmailHtml(magicUrl, emailOpts),
    });
  }
}
