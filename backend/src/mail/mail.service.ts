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
      this.logger.warn(
        `[MAIL_SKIP_SEND] No se envía correo real. Enlace mágico para ${to}: ${magicUrl} — En producción pon MAIL_SKIP_SEND=false y SMTP_*`,
      );
      return;
    }

    const host = this.config.get<string>('SMTP_HOST')?.trim();
    if (!host) {
      this.logger.error(
        'SMTP_HOST no definido: no se puede enviar el correo. Define SMTP_HOST (y SMTP_*) en el backend o, solo en local, MAIL_SKIP_SEND=true',
      );
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

    try {
      const info = await transporter.sendMail({
        from: `"${fromName}" <${from}>`,
        to,
        subject: 'AVVALE ID® - Iniciar Sesión | Avvale Companion App',
        text: buildMagicLinkEmailText(magicUrl, { appName: fromName, productTagline, ttlHint }),
        html: buildMagicLinkEmailHtml(magicUrl, emailOpts),
      });
      this.logger.log(
        `Correo enlace mágico enviado a ${to} (messageId=${(info as { messageId?: string }).messageId ?? 'n/a'})`,
      );
    } catch (err) {
      const e = err as Error & { response?: string; responseCode?: number; command?: string };
      this.logger.error(
        `SMTP sendMail falló para ${to}: ${e.message}` +
          (e.responseCode != null ? ` code=${e.responseCode}` : '') +
          (e.command != null ? ` command=${e.command}` : ''),
      );
      throw err;
    }
  }
}
