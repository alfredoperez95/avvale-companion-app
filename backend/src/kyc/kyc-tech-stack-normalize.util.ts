function normKey(k: string): string {
  return String(k || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined || v === '') return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v as Record<string, unknown>).length === 0;
  return false;
}

function mergeValues(a: unknown, b: unknown): unknown {
  if (isEmpty(a)) return b;
  if (isEmpty(b)) return a;

  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    return { ...(a as Record<string, unknown>), ...(b as Record<string, unknown>) };
  }

  const arr: unknown[] = [];
  const push = (x: unknown) => {
    if (isEmpty(x)) return;
    if (Array.isArray(x)) arr.push(...x);
    else arr.push(x);
  };
  push(a);
  push(b);

  // Dedupe simple por representación.
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const x of arr) {
    const k = typeof x === 'string' ? x.trim().toLowerCase() : JSON.stringify(x);
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out.length === 1 ? out[0] : out;
}

function splitModules(raw: string): string[] {
  const s = String(raw || '').trim();
  if (!s) return [];
  const cleaned = s
    .replace(/[.;]/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned
    .split(',')
    .flatMap((part) => part.split(/\s+y\s+|\/+/i))
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => x.replace(/\s*\((.*?)\)\s*/g, ' ($1) ' ).replace(/\s+/g, ' ').trim());
}

function mergeStringArray(prev: unknown, items: string[]): unknown {
  const base: string[] = [];
  const push = (v: unknown) => {
    if (!v) return;
    if (Array.isArray(v)) {
      for (const x of v) if (typeof x === 'string' && x.trim()) base.push(x.trim());
      return;
    }
    if (typeof v === 'string' && v.trim()) base.push(v.trim());
  };
  push(prev);
  for (const it of items) if (it && it.trim()) base.push(it.trim());
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of base) {
    const k = it.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out.length === 0 ? null : out;
}

function cleanErpText(raw: string): string {
  let s = String(raw || '').trim();
  if (!s) return s;

  // Quita coletillas tipo "— AMS (Application Management Services)." o "AMS (...)." (sin perder el resto).
  s = s.replace(/\s+—\s*AMS\s*\([^)]*\)\s*\.?/gi, ' —');
  s = s.replace(/\bAMS\s*\([^)]*\)\s*\.?/gi, '');

  // Quita frases de módulos y compras (se guardan en erp_modulos / procurement/ariba).
  s = s.replace(/(?:^|\.\s*)M[oó]dulos?\s+(?:en\s+alcance[^:]*|en\s+scope[^:]*|incluidos|en\s+ams)?\s*:?\s*[^.]+\.?/gi, '.');
  s = s.replace(/(?:^|\.\s*)[ÁA]rea\s+de\s+Compras\s*:\s*[^.]+\.?/gi, '.');

  // Limpieza de puntuación/espacios.
  s = s
    .replace(/\s+/g, ' ')
    .replace(/\s+\./g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/\.\s*\./g, '.')
    .trim();
  s = s.replace(/^—\s*/, '').trim();
  if (s.endsWith('—')) s = s.slice(0, -1).trim();
  if (s.startsWith('.')) s = s.slice(1).trim();
  if (s.startsWith('SAP') && s.includes('—') === false) {
    // no-op: deja el texto tal cual
  }
  return s;
}

function valueToText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  const t = String(text || '');
  return patterns.some((p) => p.test(t));
}

const MIDDLEWARE_PATTERNS = [
  /\bSAP\s+Process\s+Orchestration\b/i,
  /\bSAP\s+PO\b/i,
  /\bProcess\s+Orchestration\b/i,
  /\bIntegration\s+Suite\b/i,
  /\bCloud\s+Integration\b/i,
  /\bSAP\s*CPI\b/i,
  /\bMuleSoft\b/i,
  /\bBoomi\b/i,
  /\bTIBCO\b/i,
  /\bWSO2\b/i,
  /\bApigee\b/i,
  /\bAzure\s+Integration\s+Services\b/i,
];

const REPORTING_PATTERNS = [/\bPower\s*BI\b/i, /\bTableau\b/i, /\bSAP\s+Analytics\s+Cloud\b/i, /\bSAC\b/i];

function extractMiddlewareName(text: string): string | null {
  const t = String(text || '');
  if (/\bSAP\s+Process\s+Orchestration\b/i.test(t) || /\bSAP\s+PO\b/i.test(t) || /\bProcess\s+Orchestration\b/i.test(t)) {
    return 'SAP Process Orchestration (PO)';
  }
  if (/\bIntegration\s+Suite\b/i.test(t) || /\bSAP\s+Integration\s+Suite\b/i.test(t) || /\bCloud\s+Integration\b/i.test(t) || /\bSAP\s*CPI\b/i.test(t)) {
    return 'SAP Integration Suite / CPI';
  }
  if (/\bMuleSoft\b/i.test(t)) return 'MuleSoft';
  if (/\bBoomi\b/i.test(t)) return 'Boomi';
  if (/\bTIBCO\b/i.test(t)) return 'TIBCO';
  if (/\bWSO2\b/i.test(t)) return 'WSO2';
  if (/\bApigee\b/i.test(t)) return 'Apigee';
  if (/\bAzure\s+Integration\s+Services\b/i.test(t)) return 'Azure Integration Services';
  return null;
}

function extractReportingNames(text: string): string[] {
  const out: string[] = [];
  const t = String(text || '');
  if (/\bPower\s*BI\b/i.test(t)) out.push('Power BI');
  if (/\bTableau\b/i.test(t)) out.push('Tableau');
  if (/\bSAP\s+Analytics\s+Cloud\b/i.test(t) || /\bSAC\b/i.test(t)) out.push('SAP Analytics Cloud (SAC)');
  return out;
}

const TOP_LEVEL_ALIASES: Record<string, string> = {
  // HCM / People
  hcm: 'hris',
  rrhh: 'hris',
  rr_hh: 'hris',
  'rr.hh': 'hris',
  people: 'hris',
  human_resources: 'hris',
  hr: 'hris',
  hris: 'hris',

  // Nóminas
  nominas: 'payroll',
  nóminas: 'payroll',
  payroll: 'payroll',

  // Talento
  talento: 'talent',
  talent: 'talent',

  // Compras
  compras: 'procurement',
  procurement: 'procurement',
  sourcing: 'procurement',
  ariba: 'ariba',
  sap_ariba: 'ariba',

  // Seguridad / identidad
  security_notes: 'security',
  firewall: 'security',
  identity: 'security',
  iam: 'security',
  entra: 'security',
  azure_ad: 'security',
  active_directory: 'security',

  // Reporting / front-end analítica
  powerbi: 'reporting',
  power_bi: 'reporting',
  tableau: 'reporting',
  sac: 'reporting',
  frontend: 'reporting',
  front_end: 'reporting',
  visualization: 'reporting',
  visualizacion: 'reporting',

  // Middleware / iPaaS / integración
  middleware: 'middleware',
  po: 'middleware',
  sap_po: 'middleware',
  process_orchestration: 'middleware',
  sap_process_orchestration: 'middleware',
  integration_suite: 'middleware',
  sap_integration_suite: 'middleware',
  cpi: 'middleware',
  sap_cpi: 'middleware',
  mulesoft: 'middleware',
  boomi: 'middleware',
  tibco: 'middleware',
  wso2: 'middleware',
  apigee: 'middleware',
  azure_integration_services: 'middleware',
};

export function normalizeTechStack(raw: unknown): Record<string, unknown> {
  const stack = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(stack)) {
    const nk = normKey(k);
    // Partners/Vendors nunca van en tech_stack.
    if (nk.includes('partner') || nk.includes('vendor') || nk === 'partners') continue;
    const canonical = TOP_LEVEL_ALIASES[nk] ?? nk;
    out[canonical] = mergeValues(out[canonical], v);
  }

  // Extrae módulos desde el texto del ERP para poblar siempre `erp_modulos`.
  const erpText = typeof out.erp === 'string' ? out.erp : null;
  if (erpText) {
    const mods: string[] = [];
    const m1 = erpText.match(/m[oó]dulos?\s+(en\s+alcance[^:]*|en\s+scope[^:]*|incluidos|en\s+ams)?\s*:?\s*([^\n.]+)/i);
    if (m1?.[2]) mods.push(...splitModules(m1[2]));
    const m2 = erpText.match(/FI\/CO|MM\/SD|HCM|PP\/PM/gi);
    if (m2?.length) mods.push(...m2);
    if (/\bSAP\s+Ariba\b/i.test(erpText)) mods.push('SAP Ariba');
    if (/\bLandscape\s+Transformation\b/i.test(erpText) || /\bSLT\b/i.test(erpText)) mods.push('SAP Landscape Transformation (SLT)');

    if (mods.length) {
      out.erp_modulos = mergeStringArray(out.erp_modulos, mods) ?? out.erp_modulos;
    }

    const cleaned = cleanErpText(erpText);
    if (cleaned && cleaned !== erpText) out.erp = cleaned;
  }

  // Si el ERP es un objeto y contiene Integration/Middleware, elévalo a `middleware`.
  if (out.erp && typeof out.erp === 'object' && !Array.isArray(out.erp)) {
    const erpObj = out.erp as Record<string, unknown>;
    const integrationVal = erpObj.Integration ?? erpObj.integration ?? erpObj.Middleware ?? erpObj.middleware;
    const t = valueToText(integrationVal || erpObj);
    if (t && hasAny(t, MIDDLEWARE_PATTERNS)) {
      const mw = extractMiddlewareName(t);
      if (mw) out.middleware = mergeValues(out.middleware, mw);
    }
  }

  // Si hay pistas de middleware o reporting dentro de otros bloques (p.ej. analytics), elévalas.
  const whole = valueToText(out);
  if (whole && hasAny(whole, MIDDLEWARE_PATTERNS)) {
    const mw = extractMiddlewareName(whole);
    if (mw) out.middleware = mergeValues(out.middleware, mw);
  }
  if (whole && hasAny(whole, REPORTING_PATTERNS)) {
    const reps = extractReportingNames(whole);
    if (reps.length) out.reporting = mergeStringArray(out.reporting, reps) ?? out.reporting;
  }

  // Limpieza: elimina vacíos
  for (const [k, v] of Object.entries(out)) {
    if (isEmpty(v)) delete out[k];
  }

  return out;
}

