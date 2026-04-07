import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {
  buildMagicLinkEmailHtml,
  buildMagicLinkEmailText,
  DEFAULT_MAIL_LOGO_URL,
} from './templates/magic-link.email';
import {
  buildRfqAnalysisCompletedEmailHtml,
  buildRfqAnalysisCompletedEmailText,
  type RfqCompletedEmailContent,
} from './templates/rfq-analysis-completed.email';
import {
  buildInvitationRegistrationEmailHtml,
  buildInvitationRegistrationEmailText,
} from './templates/invitation-registration.email';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  private mailFrom(): { address: string; name: string } {
    const address = this.config.get<string>('MAIL_FROM')?.trim() || 'no-reply@avvalecompanion.app';
    const name = this.config.get<string>('MAIL_FROM_NAME')?.trim() || 'Avvale Companion';
    return { address, name };
  }

  private mailBranding(): { logoUrl: string; productTagline: string } {
    return {
      logoUrl: this.config.get<string>('MAIL_LOGO_URL')?.trim() || DEFAULT_MAIL_LOGO_URL,
      productTagline: this.config.get<string>('MAIL_PRODUCT_TAGLINE')?.trim() || 'Activaciones · Avvale',
    };
  }

  /** Texto de caducidad para invitaciones: días si el TTL es múltiplo de 24 h; si no, horas. */
  private invitationTtlHint(ttlHours: number): string {
    if (ttlHours > 0 && ttlHours % 24 === 0) {
      const days = ttlHours / 24;
      return days === 1
        ? 'Por seguridad, el enlace caduca en 1 día.'
        : `Por seguridad, el enlace caduca en ${days} días.`;
    }
    return `Por seguridad, el enlace caduca en ${ttlHours} horas.`;
  }

  private createTransporter(): nodemailer.Transporter {
    const host = this.config.get<string>('SMTP_HOST')?.trim();
    if (!host) {
      throw new Error('SMTP no configurado');
    }
    const port = parseInt(this.config.get<string>('SMTP_PORT') ?? '587', 10);
    const secure = this.config.get<string>('SMTP_SECURE') === 'true';
    const user = this.config.get<string>('SMTP_USER')?.trim();
    const pass = this.config.get<string>('SMTP_PASS') ?? '';
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
    });
  }

  /**
   * Envío transaccional (desde MAIL_FROM, p. ej. no-reply@avvalecompanion.app).
   * Si MAIL_SKIP_SEND=true, solo registra en log (útil en desarrollo sin SMTP).
   */
  async sendMagicLinkEmail(to: string, magicUrl: string): Promise<void> {
    const { address, name } = this.mailFrom();
    const skip = this.config.get<string>('MAIL_SKIP_SEND') === 'true';

    if (skip) {
      this.logger.warn(
        `[MAIL_SKIP_SEND] No se envía correo real. Enlace mágico para ${to}: ${magicUrl} — En producción pon MAIL_SKIP_SEND=false y SMTP_*`,
      );
      return;
    }

    let transporter: nodemailer.Transporter;
    try {
      transporter = this.createTransporter();
    } catch {
      this.logger.error(
        'SMTP_HOST no definido: no se puede enviar el correo. Define SMTP_HOST (y SMTP_*) en el backend o, solo en local, MAIL_SKIP_SEND=true',
      );
      throw new Error('SMTP no configurado');
    }

    const ttlMin = parseInt(this.config.get<string>('MAGIC_LINK_TTL_MINUTES') ?? '15', 10);
    const ttlHint = `El enlace caduca en ${ttlMin} minutos por seguridad.`;
    const { logoUrl, productTagline } = this.mailBranding();
    const emailOpts = { appName: name, ttlHint, logoUrl, productTagline };

    try {
      const info = await transporter.sendMail({
        from: `"${name}" <${address}>`,
        to,
        subject: 'AVVALE ID® - Iniciar Sesión | Avvale Companion App',
        text: buildMagicLinkEmailText(magicUrl, { appName: name, productTagline, ttlHint }),
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

  /**
   * Notificación al completar el análisis RFQ. No relanza errores SMTP (el análisis ya quedó COMPLETED).
   */
  async sendRfqAnalysisCompletedEmail(to: string, content: RfqCompletedEmailContent): Promise<void> {
    const { address, name } = this.mailFrom();
    const { logoUrl, productTagline } = this.mailBranding();
    const skip = this.config.get<string>('MAIL_SKIP_SEND') === 'true';

    if (skip) {
      this.logger.warn(
        `[MAIL_SKIP_SEND] No se envía correo RFQ completado a ${to}. Vista: ${content.viewUrl}`,
      );
      return;
    }

    const host = this.config.get<string>('SMTP_HOST')?.trim();
    if (!host) {
      this.logger.warn(`Correo RFQ completado no enviado: SMTP_HOST no definido (destino ${to})`);
      return;
    }

    let transporter: nodemailer.Transporter;
    try {
      transporter = this.createTransporter();
    } catch {
      this.logger.warn(`Correo RFQ completado no enviado: SMTP no configurado (destino ${to})`);
      return;
    }

    const subjectTitle =
      content.analysisTitle.length > 90 ? `${content.analysisTitle.slice(0, 87)}…` : content.analysisTitle;

    try {
      const info = await transporter.sendMail({
        from: `"${name}" <${address}>`,
        to,
        subject: `Análisis RFQ completado · ${subjectTitle}`,
        text: buildRfqAnalysisCompletedEmailText(content, { appName: name, productTagline }),
        html: buildRfqAnalysisCompletedEmailHtml(content, { appName: name, logoUrl, productTagline }),
      });
      this.logger.log(
        `Correo RFQ completado enviado a ${to} (messageId=${(info as { messageId?: string }).messageId ?? 'n/a'})`,
      );
    } catch (err) {
      const e = err as Error & { responseCode?: number; command?: string };
      this.logger.error(
        `SMTP: no se pudo enviar correo RFQ completado a ${to}: ${e.message}` +
          (e.responseCode != null ? ` code=${e.responseCode}` : '') +
          (e.command != null ? ` command=${e.command}` : ''),
      );
    }
  }

  /**
   * Invitación de registro (admin). Si MAIL_SKIP_SEND=true, solo log (como enlace mágico).
   */
  async sendInvitationRegistrationEmail(
    to: string,
    inviteUrl: string,
    meta: { name: string; lastName: string; ttlHours?: number },
  ): Promise<void> {
    const { address, name } = this.mailFrom();
    const skip = this.config.get<string>('MAIL_SKIP_SEND') === 'true';

    if (skip) {
      this.logger.warn(
        `[MAIL_SKIP_SEND] Invitación registro para ${to}: ${inviteUrl} — En producción pon MAIL_SKIP_SEND=false y SMTP_*`,
      );
      return;
    }

    let transporter: nodemailer.Transporter;
    try {
      transporter = this.createTransporter();
    } catch {
      this.logger.error(
        'SMTP_HOST no definido: no se puede enviar la invitación. Define SMTP_* en el backend o MAIL_SKIP_SEND=true en desarrollo.',
      );
      throw new Error('SMTP no configurado');
    }

    const { logoUrl, productTagline } = this.mailBranding();
    const ttlHours =
      meta.ttlHours ??
      parseInt(this.config.get<string>('INVITE_REGISTRATION_TTL_HOURS') ?? '168', 10);
    const ttlHint = this.invitationTtlHint(ttlHours);

    try {
      const info = await transporter.sendMail({
        from: `"${name}" <${address}>`,
        to,
        subject: `AVVALE ID® - Invitación al registro | ${name}`,
        text: buildInvitationRegistrationEmailText(inviteUrl, {
          name: meta.name,
          lastName: meta.lastName,
          appName: name,
          ttlHint,
          productTagline,
        }),
        html: buildInvitationRegistrationEmailHtml(inviteUrl, {
          name: meta.name,
          lastName: meta.lastName,
          appName: name,
          logoUrl,
          ttlHint,
          productTagline,
        }),
      });
      this.logger.log(
        `Correo invitación registro enviado a ${to} (messageId=${(info as { messageId?: string }).messageId ?? 'n/a'})`,
      );
    } catch (err) {
      const e = err as Error & { responseCode?: number; command?: string };
      this.logger.error(
        `SMTP sendMail falló (invitación) para ${to}: ${e.message}` +
          (e.responseCode != null ? ` code=${e.responseCode}` : '') +
          (e.command != null ? ` command=${e.command}` : ''),
      );
      throw err;
    }
  }
}
