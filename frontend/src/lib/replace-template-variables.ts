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
] as const;

export type TemplateVariables = {
  projectName: string;
  client: string;
  offerCode: string;
  projectAmount: string;
  projectType: '' | 'CONSULTORIA' | 'SW';
  hubspotUrl: string;
};

const SHORTCODE_MAP: Record<string, keyof TemplateVariables> = {
  nombreProyecto: 'projectName',
  cliente: 'client',
  codigoOferta: 'offerCode',
  importeProyecto: 'projectAmount',
  tipoOportunidad: 'projectType',
  urlHubSpot: 'hubspotUrl',
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
  };
  let result = html;
  for (const [shortcodeKey, formKey] of Object.entries(SHORTCODE_MAP)) {
    const placeholder = `{{${shortcodeKey}}}`;
    const value = raw[formKey];
    result = result.split(placeholder).join(escapeForHtml(value));
  }
  // Cualquier {{cualquierCosa}} restante → vacío
  result = result.replace(/\{\{[^}]+\}\}/g, '');
  return result;
}
