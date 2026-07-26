import { formatProjectAmountDisplay } from '@/lib/format-project-amount';

/**
 * Shortcodes que se sustituyen por valores del formulario al aplicar una plantilla.
 * Formato en plantilla: {{nombreProyecto}}, {{cliente}}, etc.
 */
export const TEMPLATE_SHORTCODES = [
  { value: '{{nombreProyecto}}', label: 'Nombre del proyecto' },
  { value: '{{cliente}}', label: 'Cliente' },
  { value: '{{codigoOferta}}', label: 'Código de oferta' },
  { value: '{{importeProyecto}}', label: 'Importe del proyecto' },
  { value: '{{tipoOportunidad}}', label: 'Tipo de oportunidad' },
  { value: '{{urlHubSpot}}', label: 'URL HubSpot' },
  { value: '{{Saludo}}', label: 'Saludo' },
  { value: '{{JP de Proyecto}}', label: 'JP de Proyecto (@"Nombre" con enlace email)' },
  {
    value: '{{contenidoAdministrativo}}',
    label: 'Contenido administrativo (propuesta / PFE / pedido o aceptación)',
  },
  {
    value: '{{yubiqA&S}}',
    label: 'Yubiq A&S (línea en negrita + URL enlace; vacío si faltan ambos)',
  },
  {
    value: '{{urlsEscaneadas}}',
    label: 'URLs escaneadas (solo si no hay adjuntos; lista con enlaces)',
  },
] as const;

export type TemplateVariables = {
  projectName: string;
  client: string;
  offerCode: string;
  projectAmount: string;
  projectType: '' | 'CONSULTORIA' | 'SW';
  hubspotUrl: string;
  saludo?: string;
  projectJpName?: string;
  projectJpEmail?: string;
  /** PFE del bloque Detalles administrativos. */
  pfe?: '' | 'SI' | 'NO';
  /** Pedido del bloque Detalles administrativos. */
  pedido?: '' | 'SI' | 'NO' | 'PENDIENTE';
  /** URL Yubiq A&S (`#yubiqAsUrl`). */
  yubiqAsUrl?: string;
  /** ID AES Yubiq A&S (`#yubiqAsId`). */
  yubiqAsId?: string;
  /** URLs escaneadas (HubSpot, etc.); se imprimen en plantilla solo sin adjuntos. */
  scannedUrls?: { url: string; name?: string }[];
  /** Si true, `{{urlsEscaneadas}}` se sustituye por vacío. */
  hasUploadedAttachments?: boolean;
};

const SHORTCODE_MAP: Record<string, keyof TemplateVariables> = {
  nombreProyecto: 'projectName',
  cliente: 'client',
  codigoOferta: 'offerCode',
  importeProyecto: 'projectAmount',
  tipoOportunidad: 'projectType',
  urlHubSpot: 'hubspotUrl',
  Saludo: 'saludo',
};

function escapeForHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function projectTypeLabel(projectType: '' | 'CONSULTORIA' | 'SW'): string {
  if (projectType === 'CONSULTORIA') return 'Consultoría';
  if (projectType === 'SW') return 'Software';
  return '';
}

/**
 * Frase de adjuntos según Detalles administrativos.
 * - Base: "Adjunto propuesta"
 * - Si PFE = Sí → ", PFE"
 * - Si Pedido = Sí → " y pedido."
 * - Si Pedido = Pendiente → " y aceptación del cliente, pendiente de pedido."
 * - Si Pedido = No / vacío → " y aceptación del cliente."
 *
 * Ej.: PFE Sí + Pedido Pendiente → "Adjunto propuesta, PFE y aceptación del cliente, pendiente de pedido."
 */
export function buildContenidoAdministrativo(
  pfe?: '' | 'SI' | 'NO' | null,
  pedido?: '' | 'SI' | 'NO' | 'PENDIENTE' | null,
): string {
  let phrase = 'Adjunto propuesta';
  if (pfe === 'SI') {
    phrase += ', PFE';
  }
  if (pedido === 'SI') {
    phrase += ' y pedido.';
  } else if (pedido === 'PENDIENTE') {
    phrase += ' y aceptación del cliente, pendiente de pedido.';
  } else {
    phrase += ' y aceptación del cliente.';
  }
  return phrase;
}

/**
 * Bloque Yubiq A&S para plantillas.
 * Formato (con línea en blanco antes):
 *   <strong>Yubiq A&S ID</strong>
 *   URL (enlace)
 * Si ID y URL están vacíos → cadena vacía (no pinta el bloque).
 * Si solo hay uno de los dos, pinta las líneas disponibles.
 */
export function buildYubiqAsTemplateHtml(
  yubiqAsId?: string | null,
  yubiqAsUrl?: string | null,
): string {
  const id = (yubiqAsId ?? '').trim();
  const url = (yubiqAsUrl ?? '').trim();
  if (!id && !url) return '';

  const lines: string[] = [];
  if (id) {
    lines.push(`<strong>Yubiq A&amp;S - ${escapeForHtml(id)}</strong>`);
  } else {
    lines.push('<strong>Yubiq A&amp;S</strong>');
  }
  if (url) {
    const safeUrl = escapeForHtml(url);
    lines.push(`<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeUrl}</a>`);
  }
  // Línea en blanco antes del bloque (tras contenido administrativo).
  return `<br>${lines.join('<br>')}`;
}

/**
 * Ajusta espaciado del cuerpo tras sustituir variables:
 * - Una línea en blanco entre URL HubSpot y «Asignamos a…»
 * - Sin línea extra entre JP y contenido administrativo
 * - Cierre «Cualquier cosa / ¡Saludos!» compacto
 */
function normalizeEmailClosingSpacing(html: string): string {
  let result = html;
  // Solo párrafos sin contenido (no tocar <p>&nbsp;</p> de espaciado intencional).
  result = result.replace(/<p>\s*<\/p>/gi, '');
  result = result.replace(/<p>\s*<br\s*\/?\s*>\s*<\/p>/gi, '');
  // Quitar espaciador entre JP y contenido administrativo.
  result = result.replace(
    /(como JP del proyecto\.)\s*<\/p>\s*<p>(?:&nbsp;|\s|<br\s*\/?\s*>)+<\/p>\s*<p>/gi,
    '$1</p><p>',
  );
  // Asegurar una línea en blanco antes de «Asignamos a» (tras el enlace HubSpot).
  result = result.replace(
    /(<\/a>)\s*<\/p>\s*(?:<p>(?:&nbsp;|\s|<br\s*\/?\s*>)*<\/p>\s*)*<p>\s*Asignamos a/gi,
    '$1</p><p>&nbsp;</p><p>Asignamos a',
  );
  // Si TipTap/plantilla separó el cierre en dos <p>, unificarlos.
  result = result.replace(
    /<p>\s*Cualquier cosa comentamos,\s*<\/p>\s*<p>\s*¡Saludos!\s*<\/p>/gi,
    '<p>Cualquier cosa comentamos,<br>¡Saludos!</p>',
  );
  // Evitar varios <br> entre las dos líneas del cierre.
  result = result.replace(
    /Cualquier cosa comentamos,(?:\s*<br\s*\/?\s*>)+¡Saludos!/gi,
    'Cualquier cosa comentamos,<br>¡Saludos!',
  );
  // Exactamente una línea en blanco antes del cierre (tras Yubiq / URLs).
  result = result.replace(
    /(?:<br\s*\/?\s*>|\s)*<\/p>\s*<p>\s*Cualquier cosa comentamos,/gi,
    '<br><br>Cualquier cosa comentamos,',
  );
  // Si el cierre ya está en el mismo <p>, asegurar un solo <br><br> delante.
  result = result.replace(
    /(?:<br\s*\/?\s*>){3,}Cualquier cosa comentamos,/gi,
    '<br><br>Cualquier cosa comentamos,',
  );
  return result;
}

function buildProjectJpHtml(name: string, email: string): string {
  const safeName = escapeForHtml(name.trim());
  const safeEmail = escapeForHtml(email.trim());
  return `<a href="mailto:${safeEmail}">@${safeName}</a>`;
}

function buildHubSpotUrlHtml(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  const safeUrl = escapeForHtml(trimmed);
  return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeUrl}</a>`;
}

function buildUrlsEscaneadasHtml(values: TemplateVariables): string {
  if (values.hasUploadedAttachments === true) return '';
  const items = (values.scannedUrls ?? [])
    .map((x) => ({
      url: (x.url ?? '').trim(),
      name: (x.name ?? '').trim(),
    }))
    .filter((x) => x.url);
  if (items.length === 0) return '';
  const title =
    '<p><strong>URLs escaneadas</strong> (Solo accesibles con Usuario HubSpot)</p>';
  const lis = items
    .map(({ url, name }) => {
      const safeUrl = escapeForHtml(url);
      const label = escapeForHtml(name || url);
      return `<li><a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${label}</a></li>`;
    })
    .join('');
  return `${title}<ul>${lis}</ul>`;
}

/**
 * Sustituye solo `{{urlsEscaneadas}}` (incluye variantes con espacios).
 * Si el bloque queda vacío, elimina también un `<p>` que solo contenga el placeholder
 * para no dejar párrafos en blanco en el correo.
 * Útil al guardar el borrador para que el cuerpo almacenado coincida con lo enviado a Make.
 */
export function replaceUrlsEscaneadasPlaceholder(html: string, values: TemplateVariables): string {
  const block = buildUrlsEscaneadasHtml(values);
  if (block) {
    return html.replace(/\{\{\s*urlsEscaneadas\s*\}\}/gi, block);
  }
  return html
    .replace(/<p>(?:\s|&nbsp;)*\{\{\s*urlsEscaneadas\s*\}\}(?:\s|&nbsp;)*<\/p>/gi, '')
    .replace(/\{\{\s*urlsEscaneadas\s*\}\}/gi, '');
}

/**
 * Saludo según hora: 4:01–12:30 días, 12:31–20:00 tardes, 20:01–4:00 noches.
 */
export function getTimeBasedGreeting(date?: Date): string {
  const d = date ?? new Date();
  const mins = d.getHours() * 60 + d.getMinutes();
  if (mins >= 241 && mins <= 750) return 'Buenos días a todos';
  if (mins >= 751 && mins <= 1200) return 'Buenas tardes a todos';
  return 'Buenas noches a todos';
}

/**
 * Sustituye los shortcodes {{clave}} en el HTML por los valores del formulario.
 * Shortcodes no definidos se reemplazan por cadena vacía.
 */
export function replaceTemplateVariables(html: string, values: TemplateVariables): string {
  const stringVals = {
    projectName: values.projectName ?? '',
    client: values.client ?? '',
    offerCode: values.offerCode ?? '',
    projectAmount: values.projectAmount ?? '',
    projectType: projectTypeLabel(values.projectType),
    hubspotUrl: values.hubspotUrl ?? '',
    saludo: values.saludo ?? getTimeBasedGreeting(),
    projectJpName: values.projectJpName ?? '',
    projectJpEmail: values.projectJpEmail ?? '',
  };
  let result = html;
  for (const [shortcodeKey, formKey] of Object.entries(SHORTCODE_MAP) as [
    string,
    keyof typeof stringVals,
  ][]) {
    const placeholder = `{{${shortcodeKey}}}`;
    if (shortcodeKey === 'urlHubSpot') {
      result = result.split(placeholder).join(buildHubSpotUrlHtml(stringVals[formKey]));
      continue;
    }
    const value =
      shortcodeKey === 'importeProyecto'
        ? formatProjectAmountDisplay(values.projectAmount ?? '')
        : stringVals[formKey];
    result = result.split(placeholder).join(escapeForHtml(value));
  }
  const jpHtml =
    stringVals.projectJpName.trim() && stringVals.projectJpEmail.trim()
      ? buildProjectJpHtml(stringVals.projectJpName, stringVals.projectJpEmail)
      : '';
  result = result.split('{{JP de Proyecto}}').join(jpHtml);
  const contenidoAdmin = escapeForHtml(buildContenidoAdministrativo(values.pfe, values.pedido));
  result = result.replace(/\{\{\s*contenidoAdministrativo\s*\}\}/gi, contenidoAdmin);
  const yubiqAsHtml = buildYubiqAsTemplateHtml(values.yubiqAsId, values.yubiqAsUrl);
  // TipTap / HTML puede guardar & como &amp; dentro del shortcode.
  result = result.replace(/\{\{\s*yubiqA(?:&amp;|&)S\s*\}\}/gi, yubiqAsHtml);
  result = replaceUrlsEscaneadasPlaceholder(result, values);
  // Cualquier {{cualquierCosa}} restante → vacío
  result = result.replace(/\{\{[^}]+\}\}/g, '');
  return normalizeEmailClosingSpacing(result);
}
