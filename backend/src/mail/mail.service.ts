import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

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

    await transporter.sendMail({
      from: `"${fromName}" <${from}>`,
      to,
      subject: 'Enlace para iniciar sesión',
      text: `Abre este enlace para entrar en Avvale Companion (caduca en pocos minutos). Si no has solicitado el acceso, ignora este mensaje.\n\n${magicUrl}`,
      html: `<p>Abre este enlace para iniciar sesión (caduca en pocos minutos):</p><p><a href="${magicUrl}">Iniciar sesión</a></p><p style="color:#666;font-size:12px">Si no has solicitado el acceso, ignora este mensaje.</p>`,
    });
  }
}
