'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { USER_INDUSTRY_OPTIONS, industryLabel, type UserIndustryValue } from '@/lib/user-industry';
import { kycJson } from './kycApi';
import { KYC_BLOCK_KEYS, KYC_BLOCK_META, type KycBlockKey } from './kycConstants';
import { KycBlockIcon, KycIconBuilding, KycIconDocument } from './KycInlineIcons';
import { faviconUrlFromWebsite } from './kycFaviconUrl';
import { competenciaPayload, KycCompetenciaPanel, rowsFromProfileCompetencia, type KycCompetenciaRow } from './KycCompetenciaPanel';
import { KycValueView } from './KycValueView';
import styles from './kyc-workspace.module.css';

type Prof = Record<string, unknown> | null;

export type KycProfileFocus =
  | { kind: 'block'; key: KycBlockKey }
  | { kind: 'summary' }
  | { kind: 'ficha' }
  | { kind: 'competencia' };

type Props = {
  companyId: number;
  profile: Prof;
  company: Record<string, unknown>;
  completeness: number;
  memberCount: number;
  signalCount: number;
  openQCount: number;
  onRefetch: () => void;
  /** Actualiza la fila en la lista lateral (estrella ★) sin esperar a recargar el listado. */
  onStrategicChange?: (companyId: number, strategic: boolean) => void;
  onBanner: (msg: string | null) => void;
  onIntake: () => void;
  focusRequest?: KycProfileFocus | null;
  onFocusConsumed?: () => void;
};

function initials(name: string) {
  return (name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function ringOff(completeness: number) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return c - (completeness / 100) * c;
}

export function KycProfileDashboard({
  companyId,
  profile,
  company,
  completeness,
  memberCount,
  signalCount,
  openQCount,
  onRefetch,
  onStrategicChange,
  onBanner,
  onIntake,
  focusRequest = null,
  onFocusConsumed,
}: Props) {
  const [summary, setSummary] = useState('');
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [fichaOpen, setFichaOpen] = useState(false);
  const [blockText, setBlockText] = useState<Record<string, string>>({});
  const [editKey, setEditKey] = useState<KycBlockKey | null>(null);
  const [coForm, setCoForm] = useState({
    name: '',
    sector: '',
    industry: '' as '' | UserIndustryValue,
    city: '',
    country: '',
    website: '',
    revenue: '',
    employees: '',
    tech_stack: '',
    source: '',
    notes: '',
  });
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [fichaMsg, setFichaMsg] = useState<string | null>(null);
  const [faviconFailed, setFaviconFailed] = useState(false);
  const [competenciaRows, setCompetenciaRows] = useState<KycCompetenciaRow[]>([]);
  const [summarySynthesisBusy, setSummarySynthesisBusy] = useState(false);

  const faviconSrc = useMemo(() => faviconUrlFromWebsite(String(company.website ?? '')), [company.website]);
  const heroGradUid = useId().replace(/:/g, '');
  const heroGradId = `kyc-hero-grad-${heroGradUid}`;

  const companyMetaParts = useMemo(() => {
    const parts: string[] = [];
    const ind = String(company.industry ?? '').trim();
    if (ind) parts.push(industryLabel(ind));
    parts.push(
      ...[String(company.sector ?? '').trim(), String(company.city ?? '').trim(), String(company.country ?? '').trim()].filter(
        (s) => s.length > 0,
      ),
    );
    return parts;
  }, [company.industry, company.sector, company.city, company.country]);

  useEffect(() => {
    setFaviconFailed(false);
  }, [faviconSrc]);

  useEffect(() => {
    if (!profile) return;
    setSummary(String(profile.summary ?? ''));
    const t: Record<string, string> = {};
    for (const b of KYC_BLOCK_KEYS) {
      t[b] = JSON.stringify((profile as Record<string, unknown>)[b] ?? {}, null, 2);
    }
    setBlockText(t);
    setCompetenciaRows(rowsFromProfileCompetencia((profile as Record<string, unknown>).competencia));
  }, [profile, companyId]);

  useEffect(() => {
    const rawInd = String(company.industry ?? '').trim();
    const industry: '' | UserIndustryValue =
      rawInd && (USER_INDUSTRY_OPTIONS as readonly { value: string }[]).some((o) => o.value === rawInd)
        ? (rawInd as UserIndustryValue)
        : '';
    setCoForm({
      name: String(company.name ?? ''),
      sector: String(company.sector ?? ''),
      industry,
      city: String(company.city ?? ''),
      country: String(company.country ?? ''),
      website: String(company.website ?? ''),
      revenue: String(company.revenue ?? ''),
      employees: String(company.employees ?? ''),
      tech_stack: String(company.tech_stack ?? ''),
      source: String(company.source ?? ''),
      notes: String(company.notes ?? ''),
    });
  }, [company, companyId]);

  useEffect(() => {
    if (!focusRequest || !profile) return;
    const t = window.setTimeout(() => {
      if (focusRequest.kind === 'block') {
        document.getElementById(`kyc-focus-block-${focusRequest.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        setEditKey(focusRequest.key);
      } else if (focusRequest.kind === 'summary') {
        document.getElementById('kyc-focus-summary')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        setSummaryOpen(true);
      } else if (focusRequest.kind === 'ficha') {
        document.getElementById('kyc-focus-ficha')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        setFichaOpen(true);
      } else if (focusRequest.kind === 'competencia') {
        document.getElementById('kyc-focus-competencia')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      onFocusConsumed?.();
    }, 80);
    return () => window.clearTimeout(t);
  }, [focusRequest, profile, onFocusConsumed]);

  const synthesizeSummaryFromProfile = useCallback(async () => {
    onBanner(null);
    setSummarySynthesisBusy(true);
    try {
      const r = await kycJson<{ summary?: string }>(`/api/kyc/companies/${companyId}/profile/synthesize-summary`, {
        method: 'POST',
      });
      const next = String(r?.summary ?? '').trim();
      if (next) setSummary(next);
      setSummaryOpen(true);
      onRefetch();
    } catch (e) {
      onBanner((e as Error).message);
    } finally {
      setSummarySynthesisBusy(false);
    }
  }, [companyId, onBanner, onRefetch]);

  const toggleStrategic = useCallback(async () => {
    if (!profile) return;
    const s = !Boolean(profile.strategic);
    onBanner(null);
    try {
      await kycJson(`/api/kyc/companies/${companyId}/profile`, { method: 'PATCH', body: JSON.stringify({ strategic: s }) });
      onStrategicChange?.(companyId, s);
      onRefetch();
    } catch (e) {
      onBanner((e as Error).message);
    }
  }, [companyId, profile, onStrategicChange, onRefetch, onBanner]);

  const saveProfile = useCallback(async () => {
    onBanner(null);
    setSaveMsg(null);
    const body: Record<string, unknown> = { summary, competencia: competenciaPayload(competenciaRows) };
    for (const b of KYC_BLOCK_KEYS) {
      const raw = blockText[b] ?? '{}';
      try {
        body[b] = JSON.parse(raw || '{}');
      } catch {
        setSaveMsg('JSON inválido en ' + b);
        return;
      }
    }
    try {
      await kycJson(`/api/kyc/companies/${companyId}/profile`, { method: 'PATCH', body: JSON.stringify(body) });
      setSaveMsg('Guardado');
      onRefetch();
    } catch (e) {
      onBanner((e as Error).message);
    }
  }, [companyId, summary, blockText, competenciaRows, onRefetch, onBanner]);

  const saveFicha = useCallback(async () => {
    onBanner(null);
    setFichaMsg(null);
    try {
      await kycJson(`/api/kyc/companies/${companyId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: coForm.name.trim() || undefined,
          sector: coForm.sector || null,
          industry: coForm.industry === '' ? null : coForm.industry,
          city: coForm.city || null,
          country: coForm.country || null,
          website: coForm.website || null,
          revenue: coForm.revenue || null,
          employees: coForm.employees || null,
          tech_stack: coForm.tech_stack || null,
          source: coForm.source || null,
          notes: coForm.notes || null,
        }),
      });
      setFichaMsg('Ficha actualizada');
      onRefetch();
    } catch (e) {
      onBanner((e as Error).message);
    }
  }, [companyId, coForm, onRefetch, onBanner]);

  if (!profile) {
    return <p className={styles.hint}>Activa KYC para el perfil.</p>;
  }

  const p = profile as Record<string, unknown>;
  const lastEnriched = p.last_enriched_at ? new Date(String(p.last_enriched_at)).toLocaleDateString() : '—';
  const cname = String(company.name ?? '—');

  return (
    <div className={styles.profileStack}>
      <header className={styles.hero}>
        <div className={styles.heroMain}>
          <div
            className={`${styles.heroAvatar} ${faviconSrc && !faviconFailed ? styles.heroAvatarWithIcon : ''}`}
            title={faviconSrc ? String(company.website ?? '') : undefined}
          >
            {faviconSrc && !faviconFailed ? (
              <img
                src={faviconSrc}
                alt=""
                className={styles.heroAvatarImg}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => setFaviconFailed(true)}
              />
            ) : (
              initials(cname)
            )}
          </div>
          <div className={styles.heroText}>
            <div className={styles.heroTitleRow}>
              <h1 className={styles.heroTitle}>{cname}</h1>
              {p.strategic ? (
                <span className={styles.chipStrategic} title="Cuenta marcada como estratégica">
                  <span aria-hidden>★</span> Estratégica
                </span>
              ) : null}
            </div>
            <div className={styles.heroMeta}>
              {companyMetaParts.length > 0 ? <span>{companyMetaParts.join(' · ')}</span> : null}
              {company.website ? (
                <>
                  {companyMetaParts.length > 0 ? <span className={styles.heroMetaSep} aria-hidden>·</span> : null}
                  <a href={String(company.website)} target="_blank" rel="noreferrer" className={styles.linkUrl}>
                    {String(company.website).replace(/^https?:\/\//i, '')} <span className={styles.linkExternal}>↗</span>
                  </a>
                </>
              ) : null}
              {companyMetaParts.length === 0 && !company.website ? (
                <span className={styles.heroMetaMuted}>Completa sector, industria, ubicación o web en la ficha</span>
              ) : null}
            </div>
            <p className={styles.heroSummaryLine}>
              {String(
                p.summary ||
                  'Sin resumen todavía. Genera uno desde la ficha y el perfil con IA (Resumen ejecutivo) o usa Entrevista / chat.',
              )}
            </p>
          </div>
          <div className={styles.heroRing} aria-label={`Completado ${completeness}%`}>
            <svg width="72" height="72" viewBox="0 0 80 80" className={styles.heroRingSvg} aria-hidden>
              <circle className={styles.heroRingTrack} cx="40" cy="40" r="34" fill="none" strokeWidth="7" />
              <circle
                className={styles.heroRingProgress}
                cx="40"
                cy="40"
                r="34"
                fill="none"
                stroke={`url(#${heroGradId})`}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 34}
                strokeDashoffset={ringOff(completeness)}
                transform="rotate(-90 40 40)"
              />
              <defs>
                <linearGradient id={heroGradId} x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0" stopColor="var(--fiori-shell-bg, #0a6ed1)" />
                  <stop offset="1" stopColor="var(--fiori-shell-bg-hover, #0854a0)" />
                </linearGradient>
              </defs>
              <text x="40" y="45" textAnchor="middle" fontSize="15" fontWeight="700" className={styles.heroRingPct}>
                {completeness}%
              </text>
            </svg>
            <div className={styles.heroRingLabel}>Completado</div>
          </div>
        </div>
        <div className={styles.heroStats}>
          <div className={styles.heroStat}>
            <div className={styles.heroStatN}>{memberCount}</div>
            <div className={styles.heroStatL}>Personas</div>
          </div>
          <div className={styles.heroStat}>
            <div className={styles.heroStatN}>{signalCount}</div>
            <div className={styles.heroStatL}>Señales</div>
          </div>
          <div className={styles.heroStat}>
            <div className={openQCount > 0 ? styles.heroStatNWarn : styles.heroStatN}>{openQCount}</div>
            <div className={styles.heroStatL}>Por resolver</div>
          </div>
          <div className={styles.heroStat}>
            <div className={lastEnriched === '—' ? styles.heroStatNMuted : styles.heroStatN}>{lastEnriched}</div>
            <div className={styles.heroStatL}>Última actualización</div>
          </div>
        </div>
        <div className={styles.heroActions}>
          <button type="button" className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`} onClick={toggleStrategic}>
            {p.strategic ? 'Quitar marca estratégica' : 'Marcar como estratégica'}
          </button>
        </div>
      </header>

      <section className={styles.objectSection} id="kyc-focus-ficha">
        <div className={styles.objectSectionHead}>
          <div className={styles.objectSectionTitleRow}>
            <span className={styles.objectSectionIcon} aria-hidden>
              <KycIconBuilding />
            </span>
            <h2 className={styles.objectSectionTitle}>Ficha de empresa</h2>
          </div>
          <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnSecondary}`} onClick={() => setFichaOpen((v) => !v)}>
            {fichaOpen ? 'Ocultar' : 'Editar'}
          </button>
        </div>
        {fichaOpen ? (
          <div className={styles.objectSectionBody}>
            <div className={styles.fichaGrid}>
              <div className={styles.formRow}>
                <span className={styles.label}>Nombre</span>
                <input
                  className={styles.input}
                  value={coForm.name}
                  onChange={(e) => setCoForm((c) => ({ ...c, name: e.target.value }))}
                />
              </div>
              <div className={styles.formRow}>
                <label className={styles.label} htmlFor="kyc-ficha-sector">
                  Sector (texto libre)
                </label>
                <input
                  id="kyc-ficha-sector"
                  className={styles.input}
                  value={coForm.sector}
                  onChange={(e) => setCoForm((c) => ({ ...c, sector: e.target.value }))}
                />
              </div>
              <div className={styles.formRow}>
                <label className={styles.label} htmlFor="kyc-ficha-industry">
                  Industria
                </label>
                <select
                  id="kyc-ficha-industry"
                  name="industry"
                  className={styles.input}
                  aria-label="Industria o sector"
                  value={coForm.industry}
                  onChange={(e) =>
                    setCoForm((c) => ({
                      ...c,
                      industry: (e.target.value === '' ? '' : e.target.value) as '' | UserIndustryValue,
                    }))
                  }
                >
                  <option value="">Seleccionar…</option>
                  {USER_INDUSTRY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              {(['city', 'country', 'website', 'revenue', 'employees', 'tech_stack', 'source'] as const).map((field) => (
                <div key={field} className={styles.formRow}>
                  <span className={styles.label}>
                    {field === 'tech_stack' ? 'Stack (texto)' : field.replace(/_/g, ' ')}
                  </span>
                  <input
                    className={styles.input}
                    value={coForm[field]}
                    onChange={(e) => setCoForm((c) => ({ ...c, [field]: e.target.value }))}
                  />
                </div>
              ))}
              <div className={styles.formRow}>
                <span className={styles.label}>Notas</span>
                <textarea
                  className={styles.textareaLg}
                  value={coForm.notes}
                  onChange={(e) => setCoForm((c) => ({ ...c, notes: e.target.value }))}
                  style={{ minHeight: '3rem' }}
                />
              </div>
              <div className={styles.row} style={{ justifyContent: 'space-between' }}>
                <span className={styles.hint} style={{ margin: 0 }}>
                  {fichaMsg}
                </span>
                <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} onClick={saveFicha}>
                  Guardar ficha
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className={styles.objectSection} id="kyc-focus-summary">
        <div className={styles.objectSectionHead}>
          <div className={styles.objectSectionTitleRow}>
            <span className={styles.objectSectionIcon} aria-hidden>
              <KycIconDocument />
            </span>
            <h2 className={styles.objectSectionTitle}>Resumen ejecutivo</h2>
          </div>
          <div className={styles.objectSectionActions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSm} ${styles.btnPrimary}`}
              disabled={summarySynthesisBusy}
              title="Usa la ficha de empresa, los bloques del perfil KYC, organigrama y señales para redactar el resumen (Anthropic)"
              onClick={() => void synthesizeSummaryFromProfile()}
            >
              {summarySynthesisBusy ? 'Generando…' : 'Generar con IA'}
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnSecondary}`} onClick={() => setSummaryOpen((v) => !v)}>
              {summaryOpen ? 'Ocultar' : 'Editar'}
            </button>
          </div>
        </div>
        {summaryOpen ? (
          <div className={styles.objectSectionBody}>
            <p className={styles.objectSectionHint}>
              Combina la ficha de empresa con los bloques del perfil (entrevista, chat y edición). «Generar con IA» guarda el resumen en el
              servidor y, si facturación y empleados están vacíos en la ficha pero constan en el contexto, los rellena automáticamente.
              Si retocas el texto a mano, confirma con «Guardar cambios» al pie.
            </p>
            <textarea className={styles.textareaLg} value={summary} onChange={(e) => setSummary(e.target.value)} rows={6} />
          </div>
        ) : null}
      </section>

      <KycCompetenciaPanel rows={competenciaRows} onChange={setCompetenciaRows} />

      <div className={styles.blockGrid}>
        {KYC_BLOCK_KEYS.map((b) => {
          const meta = KYC_BLOCK_META[b];
          const data = (p[b] as object) ?? {};
          const filled = data && typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length > 0;
          const editing = editKey === b;
          return (
            <div key={b} id={`kyc-focus-block-${b}`} className={styles.blockCard}>
              <div className={styles.blockCardHead}>
                <div className={styles.blockCardTitle}>
                  <span className={styles.blockIcon}>
                    <KycBlockIcon name={meta.icon} />
                  </span>
                  <span>{meta.label}</span>
                  {filled ? (
                    <span className={styles.blockPillOn}>activo</span>
                  ) : (
                    <span className={styles.blockPillOff}>vacío</span>
                  )}
                </div>
                <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnSecondary}`} onClick={() => setEditKey(editing ? null : b)}>
                  {editing ? 'Ver' : filled ? 'Editar' : '+ Añadir'}
                </button>
              </div>
              <div className={styles.blockBody}>
                {editing ? (
                  <textarea
                    className={styles.textareaLg}
                    value={blockText[b] ?? '{}'}
                    onChange={(e) => setBlockText((m) => ({ ...m, [b]: e.target.value }))}
                    style={{ minHeight: '10rem', fontFamily: 'ui-monospace, monospace', fontSize: '0.75rem' }}
                  />
                ) : (
                  <div style={{ minHeight: '4rem' }}>
                    <KycValueView v={data} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.saveBar}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} onClick={saveProfile}>
          Guardar cambios (análisis)
        </button>
        <button type="button" className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`} onClick={onIntake}>
          Entrevista
        </button>
        {saveMsg && <span className={saveMsg.startsWith('JSON') ? styles.saveErr : styles.saveOk}>{saveMsg}</span>}
      </div>
    </div>
  );
}
