'use client';

import { useMemo } from 'react';
import styles from './kyc-workspace.module.css';

function toArr(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x)));
  if (typeof v === 'string') return v.split(/[,;·•|]/).map((s) => s.trim()).filter(Boolean);
  return [String(v)];
}

const KEY_LABELS: Record<string, string> = {
  crm: 'CRM',
  erp: 'ERP',
  erp_modulos: 'Módulos ERP',
  modulos: 'Módulos',
  cloud: 'Cloud / hosting',
  infra: 'Infraestructura',
  bi: 'BI / Analytics',
  analytics: 'Analytics',
  bi_reporting: 'Informes y reporting',
  finance_consolidation: 'Consolidación financiera',
  hris: 'RR.HH. / HRIS',
  payroll: 'Nóminas',
  asset_management: 'Gestión de activos',
  fsm: 'Field Service (FSM)',
  procurement: 'Compras / Procurement',
  dev_tools: 'Desarrollo y herramientas',
  integrations: 'Integraciones',
  integracion: 'Integración',
  middleware: 'Middleware',
  btp: 'SAP BTP',
  sectoriales: 'Sectoriales',
  sectorial: 'Sectorial',
  notes: 'Notas',
  notas: 'Notas',
  system: 'Sistema',
  modules: 'Módulos',
  deployment: 'Despliegue',
  previous: 'Anterior',
  current: 'Actual',
  partner_actual: 'Partner',
  partner: 'Partner',
};

function prettyKeyLabel(key: string): string {
  const k = key.toLowerCase();
  return KEY_LABELS[k] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const BANNER_KEYS = new Set(['partner_actual', 'partner', 'dolores', 'pain_points']);
const NOTES_KEYS = new Set(['notes', 'notas']);

type StackSchemaItem = { id: string; label: string; keys: readonly string[] };
type StackSchemaSection = { title: string; items: readonly StackSchemaItem[] };

/**
 * Esquema fijo para que el Stack sea homogéneo entre empresas.
 * Las tarjetas se renderizan siempre; si falta dato, queda vacío (—).
 */
const STACK_SCHEMA: readonly StackSchemaSection[] = [
  {
    title: 'Canales y relación con cliente',
    items: [
      { id: 'crm', label: 'CRM', keys: ['crm'] },
      { id: 'marketing', label: 'Marketing / automatización', keys: ['marketing', 'marketing_cloud'] },
      { id: 'channels', label: 'Canales / ventas', keys: ['channels', 'sales'] },
    ],
  },
  {
    title: 'ERP y aplicaciones núcleo',
    items: [
      { id: 'erp', label: 'ERP', keys: ['erp'] },
      { id: 'erp_modulos', label: 'Módulos ERP', keys: ['erp_modulos', 'modulos', 'modules'] },
      { id: 'core', label: 'Aplicaciones core', keys: ['core'] },
    ],
  },
  {
    title: 'Analítica y datos',
    items: [
      { id: 'bi', label: 'BI / Analytics', keys: ['bi', 'analytics'] },
      { id: 'reporting', label: 'Reporting', keys: ['bi_reporting', 'reporting'] },
      { id: 'data_warehouse', label: 'Data warehouse', keys: ['data_warehouse', 'bw', 'bw4', 'bw4hana', 'sac'] },
    ],
  },
  {
    title: 'Infraestructura',
    items: [
      { id: 'cloud', label: 'Cloud / hosting', keys: ['cloud', 'hosting'] },
      { id: 'infra', label: 'Infraestructura / red', keys: ['infra', 'network'] },
      { id: 'security', label: 'Seguridad', keys: ['security', 'iam', 'identity', 'cyber'] },
    ],
  },
  {
    title: 'Integraciones',
    items: [
      { id: 'middleware', label: 'Middleware', keys: ['middleware', 'btp'] },
      { id: 'integrations', label: 'Integraciones', keys: ['integrations', 'integracion', 'api', 'apis'] },
    ],
  },
  {
    title: 'Desarrollo y partners tech',
    items: [
      { id: 'dev_tools', label: 'Desarrollo y herramientas', keys: ['dev_tools', 'development'] },
      { id: 'vendor', label: 'Partner / vendor tech', keys: ['vendor'] },
    ],
  },
  {
    title: 'Personas y organización',
    items: [
      { id: 'hris', label: 'RR.HH. / HRIS', keys: ['hris', 'hr', 'workday'] },
      { id: 'payroll', label: 'Nóminas', keys: ['payroll'] },
      { id: 'talent', label: 'Talento', keys: ['talent'] },
    ],
  },
  {
    title: 'Finanzas',
    items: [
      { id: 'finance_consolidation', label: 'Consolidación financiera', keys: ['finance_consolidation', 'group_reporting'] },
      { id: 'finance', label: 'Finanzas / contabilidad', keys: ['finance', 'accounting'] },
      { id: 'treasury', label: 'Tesorería', keys: ['treasury'] },
    ],
  },
  {
    title: 'Compras',
    items: [
      { id: 'procurement', label: 'Compras / Procurement', keys: ['procurement', 'sourcing'] },
      { id: 'ariba', label: 'Ariba', keys: ['ariba'] },
    ],
  },
  {
    title: 'Activos y field service',
    items: [
      { id: 'asset_management', label: 'Gestión de activos', keys: ['asset_management', 'eam'] },
      { id: 'fsm', label: 'Field Service (FSM)', keys: ['fsm'] },
      { id: 'maintenance', label: 'Mantenimiento', keys: ['maintenance'] },
    ],
  },
  {
    title: 'Sectoriales',
    items: [{ id: 'sectoriales', label: 'Sectoriales', keys: ['sectoriales', 'sectorial'] }],
  },
];

function normKey(k: string): string {
  return k.trim().toLowerCase().replace(/\s+/g, '_');
}

function isEmptyStackValue(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length === 0;
  return false;
}

function pickFirstValue(stack: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const k of keys) {
    const v = stack[k];
    if (!isEmptyStackValue(v)) return v;
  }
  return null;
}

/** Campos que van en «Aclaraciones» (contexto, histórico, notas). */
const CLARIFICATION_KEYS = new Set([
  'notes',
  'notas',
  'note',
  'previous',
  'prior',
  'legacy',
  'antes',
  'description',
  'descripcion',
  'detail',
  'details',
  'clarification',
  'clarifications',
  'remark',
  'remarks',
  'comments',
  'comment',
  'context',
  'pending',
  'pendiente',
  'open_question',
  'migration',
  'migration_notes',
  'alternatives',
  'background',
  'history',
  'rationale',
]);

/** Prioridad de campos «solución» (identidad del sistema / despliegue). */
const SOLUTION_KEY_ORDER = [
  'system',
  'current',
  'solution',
  'tool',
  'platform',
  'vendor',
  'product',
  'name',
  'deployment',
  'provider',
  'stack',
  'version',
  'modules',
  'scope',
  'integration',
];

function partitionEntries(entries: [string, unknown][]): { primary: [string, unknown][]; clarify: [string, unknown][] } {
  const primary: [string, unknown][] = [];
  const clarify: [string, unknown][] = [];
  for (const pair of entries) {
    if (CLARIFICATION_KEYS.has(normKey(pair[0]))) clarify.push(pair);
    else primary.push(pair);
  }
  primary.sort((a, b) => {
    const na = normKey(a[0]);
    const nb = normKey(b[0]);
    const ia = SOLUTION_KEY_ORDER.indexOf(na);
    const ib = SOLUTION_KEY_ORDER.indexOf(nb);
    const wa = ia === -1 ? 999 : ia;
    const wb = ib === -1 ? 999 : ib;
    if (wa !== wb) return wa - wb;
    return a[0].localeCompare(b[0], 'es');
  });
  clarify.sort((a, b) => a[0].localeCompare(b[0], 'es'));
  return { primary, clarify };
}

function renderDl(rows: [string, unknown][], dlClass: string, rowClass: string) {
  return (
    <dl className={dlClass}>
      {rows.map(([k, v]) => (
        <div key={k} className={rowClass}>
          <dt>{prettyKeyLabel(k)}</dt>
          <dd>
            <StackStructuredValue value={v} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function StackStructuredValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') {
    return <span className={styles.stackValEmpty}>—</span>;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return <span className={styles.stackValText}>{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className={styles.stackValEmpty}>—</span>;
    const primitives = value.every((x) => x !== null && typeof x !== 'object');
    if (primitives) {
      return (
        <div className={styles.stackChipRow}>
          {value.map((x, i) => (
            <span key={i} className={styles.stackChip}>
              {String(x)}
            </span>
          ))}
        </div>
      );
    }
    return (
      <ul className={styles.stackNestedUl}>
        {value.map((x, i) => (
          <li key={i}>
            <StackStructuredValue value={x} />
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const entries = Object.entries(o);
    if (entries.length === 0) return <span className={styles.stackValEmpty}>—</span>;

    const { primary, clarify } = partitionEntries(entries);

    if (clarify.length === 0) {
      if (entries.length === 1) {
        const [k, v] = entries[0]!;
        return (
          <dl className={styles.stackDl}>
            <div className={styles.stackDlRow}>
              <dt>{prettyKeyLabel(k)}</dt>
              <dd>
                <StackStructuredValue value={v} />
              </dd>
            </div>
          </dl>
        );
      }
      return renderDl(primary, styles.stackDl, styles.stackDlRow);
    }

    if (primary.length === 0) {
      return (
        <div className={styles.stackClarifyWrap}>
          <span className={styles.stackBlockEyebrow}>Aclaraciones</span>
          {renderDl(clarify, styles.stackDlMuted, styles.stackDlRowMuted)}
        </div>
      );
    }

    return (
      <div className={styles.stackSplitBody}>
        <div className={styles.stackSolutionWrap}>
          <span className={styles.stackBlockEyebrow}>Solución</span>
          {renderDl(primary, styles.stackDl, styles.stackDlRowSolution)}
        </div>
        <div className={styles.stackClarifyWrap}>
          <span className={styles.stackBlockEyebrow}>Aclaraciones</span>
          {renderDl(clarify, styles.stackDlMuted, styles.stackDlRowMuted)}
        </div>
      </div>
    );
  }
  return null;
}

type Entry = { key: string; value: unknown };

export function KycStackView({ techStack, onGotoDashboard }: { techStack: object; onGotoDashboard: () => void }) {
  const stack = techStack && typeof techStack === 'object' && !Array.isArray(techStack) ? (techStack as Record<string, unknown>) : {};

  const partner = stack.partner_actual ?? stack.partner;
  const partnerStr = partner == null ? '' : typeof partner === 'object' ? JSON.stringify(partner) : String(partner);
  const dolores = toArr(stack.dolores ?? stack.pain_points);
  const notasVal = stack.notes ?? stack.notas;
  const notasStr =
    notasVal == null || notasVal === ''
      ? ''
      : typeof notasVal === 'object'
        ? JSON.stringify(notasVal)
        : String(notasVal);

  const knownKeys = useMemo(() => {
    const s = new Set<string>();
    for (const sec of STACK_SCHEMA) {
      for (const it of sec.items) {
        for (const k of it.keys) s.add(k);
      }
    }
    for (const k of BANNER_KEYS) s.add(k);
    for (const k of NOTES_KEYS) s.add(k);
    return s;
  }, []);

  const otros: Entry[] = [];
  for (const [rawKey, value] of Object.entries(stack)) {
    const nk = normKey(rawKey);
    if (knownKeys.has(nk)) continue;
    otros.push({ key: rawKey, value });
  }
  otros.sort((a, b) => a.key.localeCompare(b.key, 'es'));

  return (
    <div className={styles.stackRoot}>
      <div className={styles.stackToolbar}>
        <div>
          <strong className={styles.stackToolbarTitle}>Stack tecnológico</strong>
          <p className={styles.stackToolbarHint}>
            Vista por categorías (datos del perfil). Las tarjetas vacías indican lo que falta por completar.
          </p>
        </div>
        <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={onGotoDashboard}>
          Editar en Resumen
        </button>
      </div>

      {partnerStr || dolores.length > 0 ? (
        <div className={styles.stackBannerRow}>
          {partnerStr ? (
            <span className={styles.stackPartnerPill}>
              Partner: <strong>{partnerStr}</strong>
            </span>
          ) : null}
          {dolores.map((d, i) => (
            <span key={i} className={styles.stackPainChip}>
              ⚠ {d}
            </span>
          ))}
        </div>
      ) : null}

      <div className={styles.stackCard}>
        {Object.keys(stack).length === 0 ? (
          <div className={styles.hint} style={{ marginBottom: '0.75rem' }}>
            Aún no hay información. Puedes completarla desde «Editar en Resumen» o con la entrevista / chat KYC.
          </div>
        ) : null}

        {STACK_SCHEMA.map((sec) => (
          <section key={sec.title} className={styles.stackSection}>
            <h3 className={styles.stackSectionTitle}>{sec.title}</h3>
            <div className={styles.stackSectionGrid}>
              {sec.items.map((it) => (
                <article key={it.id} className={styles.stackItemCard}>
                  <div className={styles.stackItemLabel}>{it.label}</div>
                  <div className={styles.stackItemBody}>
                    <StackStructuredValue value={pickFirstValue(stack, it.keys)} />
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}

        {otros.length > 0 ? (
          <section className={styles.stackSection}>
            <h3 className={styles.stackSectionTitle}>Otros sistemas y campos</h3>
            <div className={styles.stackSectionGrid}>
              {otros.map(({ key, value }) => (
                <article key={key} className={styles.stackItemCard}>
                  <div className={styles.stackItemLabel}>{prettyKeyLabel(key)}</div>
                  <div className={styles.stackItemBody}>
                    <StackStructuredValue value={value} />
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {notasStr ? (
          <div className={styles.stackNotesBlock}>
            <span className={styles.stackNotesLabel}>Notas</span>
            <p className={styles.stackNotesText}>{notasStr}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
