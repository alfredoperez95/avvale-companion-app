/**
 * Extracción y aplicación de traducción EN para el informe KYC estático (`public/kyc/report.html`).
 * La API conserva ids y estructura; solo cambian textos legibles por humanos.
 */

export type KycFullCompanyApi = {
  company: Record<string, unknown>;
  profile: Record<string, unknown> | null;
  completeness: number;
  org: { members: Record<string, unknown>[]; relationships: Record<string, unknown>[] };
  signals: Record<string, unknown>[];
  open_questions: Record<string, unknown>[];
};

function stripOptionalMarkdownFence(raw: string): string {
  let s = String(raw ?? '').trim();
  if (!s.startsWith('```')) return s;
  const firstNl = s.indexOf('\n');
  if (firstNl === -1) return s;
  s = s.slice(firstNl + 1).trim();
  if (s.endsWith('```')) s = s.slice(0, -3).trim();
  return s;
}

function recoverJsonObjectString(raw: string): string {
  let s = stripOptionalMarkdownFence(String(raw ?? '')).trim();
  if (!s) return '';
  try {
    JSON.parse(s);
    return s;
  } catch {
    /* seguir */
  }
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first >= 0 && last > first) return s.slice(first, last + 1);
  return s;
}

export function safeParseTranslatedJson(raw: string): Record<string, unknown> | null {
  const fenced = recoverJsonObjectString(raw);
  try {
    const v = JSON.parse(fenced) as unknown;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return normalizeClaudeTranslationKeys(v as Record<string, unknown>);
    }
  } catch {
    return null;
  }
  return null;
}

/** El modelo a veces devuelve camelCase; el informe espera snake_case como el sobre de entrada. */
export function normalizeClaudeTranslationKeys(raw: Record<string, unknown>): Record<string, unknown> {
  const n = { ...raw };
  const alias = (camel: string, snake: string) => {
    if (n[snake] === undefined && n[camel] !== undefined) n[snake] = n[camel];
  };
  alias('profileSummary', 'profile_summary');
  alias('profileBlocks', 'profile_blocks');
  alias('techStack', 'tech_stack');
  alias('signalIntel', 'signal_intel');
  alias('openQuestions', 'open_questions');
  alias('orgMembers', 'org_members');
  alias('orgRelationships', 'org_relationships');

  const pb = n.profile_blocks;
  if (pb && typeof pb === 'object' && !Array.isArray(pb)) {
    const pbo = pb as Record<string, unknown>;
    const pba = (camel: string, snake: string) => {
      if (pbo[snake] === undefined && pbo[camel] !== undefined) pbo[snake] = pbo[camel];
    };
    pba('businessModel', 'business_model');
    pba('criticalProcesses', 'critical_processes');
    pba('sectorContext', 'sector_context');
  }
  return n;
}

/** Parte 1: ficha + bloques + stack + avvale + hipótesis (suele ser la más grande). */
export function reportTranslationEnvelopePartA(envelope: Record<string, unknown>): Record<string, unknown> {
  return {
    company: envelope.company,
    profile_summary: envelope.profile_summary,
    profile_blocks: envelope.profile_blocks,
    tech_stack: envelope.tech_stack,
    avvale: envelope.avvale,
    signal_intel: envelope.signal_intel,
  };
}

/** Parte 2: listas y organigrama (respuesta más corta → menos riesgo de truncado). */
export function reportTranslationEnvelopePartB(envelope: Record<string, unknown>): Record<string, unknown> {
  return {
    signals: envelope.signals,
    open_questions: envelope.open_questions,
    org_members: envelope.org_members,
    org_relationships: envelope.org_relationships,
  };
}

export function mergeTranslationEnvelopeParts(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): Record<string, unknown> {
  return { ...a, ...b };
}

/** Payload compacto enviado a Claude (misma forma que esperamos de vuelta). */
export function buildReportTranslationEnvelope(data: KycFullCompanyApi): Record<string, unknown> {
  const p = data.profile;
  const ts = p?.tech_stack ?? null;
  return {
    company: {
      sector: data.company.sector ?? null,
      industry: data.company.industry ?? null,
      city: data.company.city ?? null,
      country: data.company.country ?? null,
      revenue: data.company.revenue ?? null,
      employees: data.company.employees ?? null,
      notes: data.company.notes ?? null,
    },
    profile_summary: p?.summary ?? null,
    profile_blocks: {
      economics: p?.economics ?? null,
      business_model: p?.business_model ?? null,
      customers: p?.customers ?? null,
      critical_processes: p?.critical_processes ?? null,
      sector_context: p?.sector_context ?? null,
      competencia: p?.competencia ?? null,
    },
    tech_stack: ts,
    avvale: p?.avvale ?? null,
    signal_intel: p?.signal_intel ?? null,
    signals: (data.signals ?? []).map((s) => ({
      id: s.id,
      title: s.title ?? null,
      text: s.text ?? null,
      source: s.source ?? null,
    })),
    open_questions: (data.open_questions ?? []).map((q) => ({
      id: q.id,
      topic: q.topic,
      question: q.question,
    })),
    org_members: Object.fromEntries(
      (data.org?.members ?? []).map((m) => [
        String(m.id),
        { role: m.role ?? null, area: m.area ?? null, notes: m.notes ?? null },
      ]),
    ),
    org_relationships: (data.org?.relationships ?? []).map((r) => ({
      id: r.id,
      type: r.type,
      notes: r.notes ?? null,
    })),
  };
}

const MAX_ENVELOPE_CHARS = 260_000;

/** Reduce solo el array de señales si el JSON supera el límite (sin tocar el resto del perfil). */
export function truncateEnvelopeIfNeeded(envelope: Record<string, unknown>): Record<string, unknown> {
  let copy = JSON.parse(JSON.stringify(envelope)) as Record<string, unknown>;
  while (JSON.stringify(copy).length > MAX_ENVELOPE_CHARS) {
    const sigs = copy.signals;
    if (!Array.isArray(sigs) || sigs.length <= 5) break;
    copy.signals = sigs.slice(0, Math.max(5, Math.floor(sigs.length * 0.65)));
  }
  return copy;
}

export function applyReportEnglishTranslation(
  original: KycFullCompanyApi,
  translated: Record<string, unknown>,
): KycFullCompanyApi {
  const out = JSON.parse(JSON.stringify(original)) as KycFullCompanyApi;

  const tc = translated.company as Record<string, unknown> | undefined;
  if (tc && out.company) {
    for (const k of ['sector', 'industry', 'city', 'country', 'revenue', 'employees', 'notes'] as const) {
      if (tc[k] !== undefined && tc[k] !== null && String(tc[k]).trim() !== '') {
        out.company[k] = tc[k];
      }
    }
  }

  if (out.profile) {
    if (translated.profile_summary !== undefined) {
      out.profile.summary =
        translated.profile_summary === null || translated.profile_summary === ''
          ? translated.profile_summary
          : String(translated.profile_summary);
    }
    const pb = translated.profile_blocks as Record<string, unknown> | undefined;
    if (pb && typeof pb === 'object') {
      for (const key of [
        'economics',
        'business_model',
        'customers',
        'critical_processes',
        'sector_context',
        'competencia',
      ] as const) {
        if (pb[key] !== undefined) out.profile[key] = pb[key] as unknown;
      }
    }
    if (translated.tech_stack !== undefined && translated.tech_stack !== null) {
      out.profile.tech_stack = translated.tech_stack as unknown;
    }
    if (translated.avvale !== undefined) out.profile.avvale = translated.avvale as unknown;
    if (translated.signal_intel !== undefined) out.profile.signal_intel = translated.signal_intel as unknown;
  }

  const tsigs = translated.signals as { id?: unknown; title?: unknown; text?: unknown; source?: unknown }[] | undefined;
  if (Array.isArray(tsigs) && out.signals) {
    const byId = new Map(tsigs.map((s) => [Number(s.id), s]));
    for (const s of out.signals) {
      const t = byId.get(Number(s.id));
      if (!t) continue;
      if (t.title !== undefined) s.title = t.title;
      if (t.text !== undefined) s.text = t.text;
      if (t.source !== undefined) s.source = t.source;
    }
  }

  const toq = translated.open_questions as { id?: unknown; topic?: unknown; question?: unknown }[] | undefined;
  if (Array.isArray(toq) && out.open_questions) {
    const byId = new Map(toq.map((q) => [Number(q.id), q]));
    for (const q of out.open_questions) {
      const t = byId.get(Number(q.id));
      if (!t) continue;
      if (t.topic !== undefined) q.topic = t.topic;
      if (t.question !== undefined) q.question = t.question;
    }
  }

  const tom = translated.org_members as Record<string, { role?: unknown; area?: unknown; notes?: unknown }> | undefined;
  if (tom && out.org?.members) {
    for (const m of out.org.members) {
      const id = String(m.id);
      const t = tom[id];
      if (!t) continue;
      if (t.role !== undefined) m.role = t.role;
      if (t.area !== undefined) m.area = t.area;
      if (t.notes !== undefined) m.notes = t.notes;
    }
  }

  const trels = translated.org_relationships as { id?: unknown; type?: unknown; notes?: unknown }[] | undefined;
  if (Array.isArray(trels) && out.org?.relationships) {
    const byId = new Map(trels.map((r) => [Number(r.id), r]));
    for (const r of out.org.relationships) {
      const t = byId.get(Number(r.id));
      if (!t) continue;
      if (t.type !== undefined) r.type = t.type;
      if (t.notes !== undefined) r.notes = t.notes;
    }
  }

  return out;
}

export const REPORT_TRANSLATE_SYSTEM = `You are a professional translator for B2B KYC reports.

Output rules (critical):
- Reply with ONE valid JSON object only. No markdown code fences, no commentary before or after.
- The JSON must have exactly the same keys, nesting, array lengths and element order as the input.
- Translate every human-readable string value into natural English (US).
- Do NOT translate: JSON keys; numeric ids; URLs; email addresses; bare numbers; ISO dates; slugs like grow/run/wise/yubiq/saiborg/axazure; product brands (SAP, Salesforce, Microsoft, Oracle, etc.) unless they are wrapped in descriptive Spanish text.
- Preserve person names and the company's legal name if present in strings (keep recognizable proper nouns).
- For relationship "type" fields that are Spanish words (e.g. aliado, bloqueador), translate to a short English label (ally, blocker, etc.) suitable for a report.
- If a value is null or empty string, keep it as-is.
- Do not add or remove properties.
- sentiment fields on signals are usually English enums — leave values like positive/neutral/negative unchanged if already English.`;
