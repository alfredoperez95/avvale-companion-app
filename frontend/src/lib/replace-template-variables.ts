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
 * Interpreta el texto de importe (miles con punto, decimales con coma, solo dígitos, etc.) a número.
 */
function parseProjectAmountToNumber(raw: string): number | null {
  if (!raw?.trim()) return null;
  let s = raw
    .trim()
    .replace(/\u00a0/g, '')
    .replace(/\s/g, '')
    .replace(/€/g, '');
  if (!s) return null;

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    s = s.replace(',', '.');
  } else if (hasDot) {
    const parts = s.split('.');
    if (parts.length > 2) {
      s = parts.join('');
    } else if (
      parts.length === 2 &&
      parts[1].length === 3 &&
      /^\d+$/.test(parts[0]) &&
      /^\d{3}$/.test(parts[1])
    ) {
      s = parts[0] + parts[1];
    }
  }

  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Importe fijo a 2 decimales, miles con punto y coma decimal (es-ES).
 * Evita depender del data ICU del runtime (algunos entornos no agrupan y muestran "3590,00").
 */
function formatEuroEsFixed2(n: number): string {
  if (!Number.isFinite(n)) return '';
  const negative = n < 0;
  const abs = Math.abs(n);
  const parts = abs.toFixed(2).split('.');
  const intStr = parts[0] ?? '0';
  const frac = parts[1] ?? '00';
  const grouped = intStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const num = `${grouped},${frac}`;
  return negative ? `-${num}` : num;
}

/** Formato visual para plantillas: "3.590,00 €". */
function formatImporteProyectoEs(raw: string): string {
  const n = parseProjectAmountToNumber(raw);
  if (n === null) return raw.trim();
  return `${formatEuroEsFixed2(n)} €`;
}

function buildProjectJpHtml(name: string, email: string): string {
  const safeName = escapeForHtml(name.trim());
  const safeEmail = escapeForHtml(email.trim());
  return `<a href="mailto:${safeEmail}">@${safeName}</a>`;
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
  const raw: Record<keyof TemplateVariables, string> = {
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
  for (const [shortcodeKey, formKey] of Object.entries(SHORTCODE_MAP)) {
    const placeholder = `{{${shortcodeKey}}}`;
    const value =
      shortcodeKey === 'importeProyecto'
        ? formatImporteProyectoEs(values.projectAmount ?? '')
        : raw[formKey];
    result = result.split(placeholder).join(escapeForHtml(value));
  }
  const jpHtml =
    raw.projectJpName.trim() && raw.projectJpEmail.trim()
      ? buildProjectJpHtml(raw.projectJpName, raw.projectJpEmail)
      : '';
  result = result.split('{{JP de Proyecto}}').join(jpHtml);
  // Cualquier {{cualquierCosa}} restante → vacío
  result = result.replace(/\{\{[^}]+\}\}/g, '');
  return result;
}
