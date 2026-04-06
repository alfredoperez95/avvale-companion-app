/**
 * Misma estética que el enlace mágico (`magic-link.email.ts`): tarjeta AVVALE ID®, logo, barra inferior con CTA.
 */

import { DEFAULT_MAIL_LOGO_URL } from './magic-link.email';

export { DEFAULT_MAIL_LOGO_URL };

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

/** Unidades Avvale desde el JSON del insight (objetos con `unit` o strings legacy). */
export function avvaleUnitNamesFromInsightJson(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  const out: string[] = [];
  for (const x of val) {
    if (typeof x === 'string' && x.trim()) {
      out.push(x.trim());
    } else if (x && typeof x === 'object' && 'unit' in x) {
      const u = (x as { unit?: unknown }).unit;
      if (typeof u === 'string' && u.trim()) out.push(u.trim().toUpperCase());
    }
  }
  return [...new Set(out)];
}

export type RfqCompletedEmailContent = {
  analysisTitle: string;
  viewUrl: string;
  /** Una línea por fuente (p. ej. "Archivo: spec.pdf", "Cuerpo del email"). */
  sourceLines: string[];
  /** Códigos de unidad Avvale (RUN, GROW, …). */
  avvaleUnitNames: string[];
};

export function buildRfqAnalysisCompletedEmailHtml(
  content: RfqCompletedEmailContent,
  options?: { appName?: string; logoUrl?: string; productTagline?: string },
): string {
  const appName = options?.appName?.trim() || 'Avvale Companion';
  const logoUrl = (options?.logoUrl?.trim() || DEFAULT_MAIL_LOGO_URL).trim();
  const productTagline = options?.productTagline?.trim() || 'Activaciones · Avvale';
  const safeTitle = escapeHtml(content.analysisTitle);
  const hrefUrl = escapeAttr(content.viewUrl);
  const safeUrlDisplay = escapeHtml(content.viewUrl);
  const safeLogoSrc = escapeAttr(logoUrl);

  const sourcesHtml =
    content.sourceLines.length > 0
      ? `<ul style="margin:0.35rem 0 0;padding-left:1.15rem;color:${'#5b6d7f'};font-size:0.9rem;line-height:1.5;">
${content.sourceLines.map((line) => `          <li style="margin:0.2rem 0;">${escapeHtml(line)}</li>`).join('\n')}
        </ul>`
      : `<p style="margin:0.35rem 0 0;font-size:0.9rem;color:${'#5b6d7f'};">—</p>`;

  const areasText =
    content.avvaleUnitNames.length > 0
      ? escapeHtml(content.avvaleUnitNames.join(', '))
      : '—';

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
  const urlBoxBg = '#f8f9fb';
  const urlBoxBorder = '#dde2e8';
  const blockLabel = '#102136';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Análisis RFQ listo · AVVALE ID</title>
</head>
<body style="margin:0;padding:0;background-color:${pageBg};font-family:'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:transparent;">
    ${safeTitle} — Análisis RFQ completado. Consulta el resultado en la app.
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
                    <h1 style="margin:1.5rem 0 0.15rem;font-size:2.25rem;font-weight:700;line-height:1.02;color:${titleColor};letter-spacing:-0.02em;">Análisis RFQ listo</h1>
                    <p style="margin:0;font-size:0.95rem;line-height:1.45;color:${subtitleColor};">Tu análisis estructurado ya está disponible.</p>
                    <p style="margin:0.75rem 0 0;font-size:0.8125rem;line-height:1.45;color:${bodyMuted};">${escapeHtml(
                      appName,
                    )} · ${escapeHtml(productTagline)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:1.75rem 2.7rem 1.25rem;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                      <tr>
                        <td style="padding:0 0 1rem;">
                          <p style="margin:0;font-size:0.8125rem;font-weight:700;letter-spacing:0.02em;text-transform:uppercase;color:#758ca4;">Nombre</p>
                          <p style="margin:0.35rem 0 0;font-size:0.95rem;font-weight:600;line-height:1.45;color:${blockLabel};">${safeTitle}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:0 0 1rem;">
                          <p style="margin:0;font-size:0.8125rem;font-weight:700;letter-spacing:0.02em;text-transform:uppercase;color:#758ca4;">Fuentes de datos procesadas</p>
                          ${sourcesHtml}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:0 0 1.1rem;border-bottom:1px solid ${footerBarBorder};">
                          <p style="margin:0;font-size:0.8125rem;font-weight:700;letter-spacing:0.02em;text-transform:uppercase;color:#758ca4;">Áreas Avvale detectadas</p>
                          <p style="margin:0.35rem 0 0;font-size:0.95rem;line-height:1.5;color:${bodyMuted};">${areasText}</p>
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
                            Ver análisis
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

export function buildRfqAnalysisCompletedEmailText(
  content: RfqCompletedEmailContent,
  options?: { appName?: string; productTagline?: string },
): string {
  const appName = options?.appName?.trim() || 'Avvale Companion';
  const tag = options?.productTagline?.trim() || 'Activaciones · Avvale';
  const sourcesBlock =
    content.sourceLines.length > 0
      ? content.sourceLines.map((l) => `  · ${l}`).join('\n')
      : '  · —';
  const areasBlock =
    content.avvaleUnitNames.length > 0 ? content.avvaleUnitNames.join(', ') : '—';

  return `AVVALE ID®
Análisis RFQ listo.

${appName} (${tag})

Nombre:
${content.analysisTitle}

Fuentes de datos procesadas:
${sourcesBlock}

Áreas Avvale detectadas:
${areasBlock}

Ver análisis:
${content.viewUrl}
`;
}
