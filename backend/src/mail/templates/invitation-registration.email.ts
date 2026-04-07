/**
 * Misma estética que el enlace mágico (`magic-link.email.ts`) y RFQ completado:
 * AVVALE ID®, logo SAP/Avvale, tarjeta, barra inferior con CTA «Completar registro».
 */

import { DEFAULT_MAIL_LOGO_URL } from './magic-link.email';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/** Texto fijo de contexto (producto); el nombre visible de la app viene en `appName`. */
function platformIntroHtml(appName: string, titleColor: string, bodyMuted: string): string {
  const safeName = escapeHtml(appName);
  return `<p style="margin:0 0 1rem;font-size:0.95rem;line-height:1.55;color:${bodyMuted};">
  <strong style="color:${titleColor};font-weight:600;">${safeName}</strong> es la plataforma corporativa Avvale para coordinar
  <strong style="color:${titleColor};font-weight:600;">activaciones de propuestas</strong>, crear rápidamente aprobaciones en
  <strong style="color:${titleColor};font-weight:600;">YUBIQ</strong> o realiza
  <strong style="color:${titleColor};font-weight:600;">análisis de oportunidades (RFQ)</strong>,
  con acceso unificado y seguro mediante AVVALE ID&reg;.
</p>`;
}

function platformIntroText(appName: string): string {
  return `${appName} es la plataforma corporativa Avvale para coordinar activaciones de propuestas, crear rápidamente aprobaciones en YUBIQ o realiza análisis de oportunidades (RFQ), con acceso unificado y seguro mediante AVVALE ID®.`;
}

export function buildInvitationRegistrationEmailHtml(
  inviteUrl: string,
  options?: {
    name?: string;
    lastName?: string;
    appName?: string;
    logoUrl?: string;
    ttlHint?: string;
    /** Reservado por compatibilidad con el envío; el subtítulo del correo usa texto fijo «Avvale ID®». */
    productTagline?: string;
  },
): string {
  const appName = options?.appName?.trim() || 'Avvale Companion';
  const logoUrl = (options?.logoUrl?.trim() || DEFAULT_MAIL_LOGO_URL).trim();
  const ttlHint = escapeHtml(
    options?.ttlHint?.trim() ||
      'Por seguridad, el enlace caduca en 7 días. Si expira, pide una nueva invitación al administrador.',
  );
  const firstName = options?.name?.trim() ?? '';
  const greeting = firstName
    ? escapeHtml(`¡Bienvenido ${firstName}!`)
    : escapeHtml('¡Bienvenido!');
  const hrefUrl = escapeAttr(inviteUrl);
  const safeUrlDisplay = escapeHtml(inviteUrl);
  const safeLogoSrc = escapeAttr(logoUrl);

  const pageBg = '#f5f6f7';
  const cardBg = '#ffffff';
  const cardBorder = '#dde2e8';
  const brandKickerColor = '#0e548c';
  const titleColor = '#102136';
  const subtitleColor = '#1f2c3b';
  const bodyMuted = '#5b6d7f';
  const accentBlue = '#0064d9';
  const footerBarBg = '#eef1f4';
  const footerBarBorder = '#e0e5ea';
  const infoBarBg = '#f0f6fb';
  const infoBarBorder = '#0e548c';
  const urlBoxBg = '#f8f9fb';
  const urlBoxBorder = '#dde2e8';

  const introBlock = platformIntroHtml(appName, titleColor, bodyMuted);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invitación al registro · AVVALE ID</title>
</head>
<body style="margin:0;padding:0;background-color:${pageBg};font-family:'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:transparent;">
    AVVALE ID — Invitación al registro. Completa tu acceso en ${escapeHtml(appName)}.
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:${pageBg};padding:32px 16px 48px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:34rem;">
          <tr>
            <td style="background-color:${cardBg};border:1px solid ${cardBorder};border-radius:1.2rem;box-shadow:0 0.55rem 1.85rem rgba(27,49,68,0.1);overflow:hidden;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding:2.75rem 2.7rem 0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="vertical-align:top;text-align:left;width:55%;">
                          <p style="margin:0;font-size:0.95rem;font-weight:700;line-height:1.1;letter-spacing:-0.01em;color:${brandKickerColor};">AVVALE ID&reg;</p>
                        </td>
                        <td style="vertical-align:top;text-align:right;width:45%;">
                          <img src="${safeLogoSrc}" width="125" alt="Avvale" style="display:inline-block;max-width:7.8rem;width:125px;height:auto;border:0;outline:none;text-decoration:none;" />
                        </td>
                      </tr>
                    </table>
                    <h1 style="margin:1.5rem 0 0.15rem;font-size:2.25rem;font-weight:700;line-height:1.02;color:${titleColor};letter-spacing:-0.02em;">Invitación al registro</h1>
                    <p style="margin:0;font-size:0.95rem;line-height:1.45;color:${subtitleColor};">Accede con tu cuenta corporativa · Avvale ID&reg;</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:1.75rem 2.7rem 1.25rem;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                      <tr>
                        <td style="padding:0 0 0.85rem;">
                          <p style="margin:0;font-size:0.95rem;font-weight:500;line-height:1.55;color:${bodyMuted};">${greeting}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:0 0 1rem;">
                          ${introBlock}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:0 0 1rem;">
                          <p style="margin:0;font-size:0.95rem;font-weight:500;line-height:1.55;color:${bodyMuted};">
                            Has sido invitado a crear tu cuenta en <strong style="color:${titleColor};font-weight:600;">${escapeHtml(appName)}</strong>.
                            Completa tu contraseña y los datos pendientes pulsando <strong style="color:${titleColor};font-weight:600;">Completar registro</strong> en la barra inferior.
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:0 0 1rem;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                            <tr>
                              <td style="width:4px;background-color:${infoBarBorder};border-radius:2px;font-size:0;line-height:0;">&nbsp;</td>
                              <td style="padding:0.65rem 0.85rem;background-color:${infoBarBg};border-radius:0 6px 6px 0;">
                                <p style="margin:0;font-size:0.8125rem;line-height:1.5;color:${bodyMuted};">${ttlHint}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:0 0 1.1rem;border-bottom:1px solid ${footerBarBorder};">
                          <p style="margin:0;font-size:0.75rem;line-height:1.5;color:#8a9bab;">
                            Si no esperabas esta invitación, puedes ignorar este mensaje.
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:1.1rem 0 0;">
                          <p style="margin:0 0 0.45rem;font-size:0.78rem;font-weight:600;letter-spacing:0.02em;text-transform:uppercase;color:#758ca4;">
                            ¿El botón no responde?
                          </p>
                          <p style="margin:0 0 0.5rem;font-size:0.8125rem;line-height:1.45;color:${bodyMuted};">
                            Copia y pega en el navegador:
                          </p>
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                            <tr>
                              <td style="padding:0.65rem 0.75rem;background-color:${urlBoxBg};border:1px solid ${urlBoxBorder};border-radius:6px;">
                                <p style="margin:0;font-size:0.75rem;line-height:1.5;font-family:'Segoe UI',Roboto,Consolas,monospace;word-break:break-all;color:${accentBlue};">${safeUrlDisplay}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:1.35rem 2.7rem;border-top:1px solid ${footerBarBorder};background-color:${footerBarBg};border-bottom-left-radius:1.2rem;border-bottom-right-radius:1.2rem;">
                    <table role="presentation" cellspacing="0" cellpadding="0" align="right" style="margin:0;">
                      <tr>
                        <td style="border-radius:0.56rem;background-color:${accentBlue};box-shadow:0 0.12rem 0.35rem rgba(0,100,217,0.35);">
                          <a href="${hrefUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;min-width:8.8rem;padding:0.48rem 1.25rem;font-size:0.92rem;font-weight:600;color:#ffffff;text-decoration:none;border-radius:0.56rem;font-family:'Segoe UI',Roboto,sans-serif;text-align:center;">
                            Completar registro
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <p style="margin:20px 0 0;font-size:0.6875rem;color:#9aa8b6;text-align:center;line-height:1.4;">
          Mensaje automático · ${escapeHtml(appName)}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildInvitationRegistrationEmailText(
  inviteUrl: string,
  options?: {
    name?: string;
    lastName?: string;
    appName?: string;
    ttlHint?: string;
    productTagline?: string;
  },
): string {
  const appName = options?.appName?.trim() || 'Avvale Companion';
  const firstName = options?.name?.trim() ?? '';
  const ttl =
    options?.ttlHint?.trim() ||
    'Por seguridad, el enlace caduca en 7 días. Si expira, pide una nueva invitación al administrador.';

  const lines = [
    'AVVALE ID®',
    'Invitación al registro — Accede con tu cuenta corporativa · Avvale ID®.',
    '',
    appName,
    '',
    firstName ? `¡Bienvenido ${firstName}!` : '¡Bienvenido!',
    '',
    platformIntroText(appName),
    '',
    `Has sido invitado a crear tu cuenta en ${appName}. Completa tu contraseña y los datos pendientes aquí:`,
    inviteUrl,
    '',
    ttl,
    '',
    'Si no esperabas esta invitación, puedes ignorar este mensaje.',
  ];
  return lines.join('\n');
}
