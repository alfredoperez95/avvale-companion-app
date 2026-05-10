'use client';

import { useMemo, useState } from 'react';
import { kycJson } from './kycApi';
import styles from './kyc-workspace.module.css';

type Sig = {
  id: number;
  source: string;
  source_url: string | null;
  title: string | null;
  text: string | null;
  sentiment: string | null;
  published_at: string | null;
  captured_at?: string | null;
  signal_type?: string | null;
};

function sentimentLabel(s: string | null) {
  const v = (s || '').toLowerCase();
  if (!v) return 'Sin clasificar';
  if (v === 'positive') return 'Positivo';
  if (v === 'neutral') return 'Neutral';
  if (v === 'negative') return 'Negativo';
  if (v === 'mixed') return 'Mixto';
  return s || 'Sin clasificar';
}

/** Etiqueta legible para chips (p. ej. google_news → Google News). */
function formatSignalSource(raw: string) {
  const k = (raw || '').trim().toLowerCase().replace(/\s+/g, '_');
  const map: Record<string, string> = {
    google_news: 'Google News',
    rss: 'RSS',
    manual: 'Manual',
    news: 'Noticias',
  };
  if (map[k]) return map[k];
  if (!raw.trim()) return 'Fuente';
  return raw
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizedSignalBodyEqualsTitle(title: string, body: string) {
  const a = normalizeText(title);
  const b = normalizeText(body);
  if (!a || !b) return false;
  return a === b;
}

function sentimentChipClass(stylesMod: typeof styles, s: string | null): string {
  const v = (s || '').toLowerCase();
  if (v === 'positive') return stylesMod.sigChipPositive;
  if (v === 'negative') return stylesMod.sigChipNegative;
  if (v === 'mixed') return stylesMod.sigChipMixed;
  if (v === 'neutral') return stylesMod.sigChipNeutral;
  return stylesMod.sigChipSentimentUnknown;
}

function normalizeText(s: string) {
  return String(s ?? '')
    .replace(/&nbsp;|&#160;/gi, ' - ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/(?:\s*-\s*){2,}/g, ' - ')
    .trim();
}

function DashBold({ text }: { text: string }) {
  const t = normalizeText(text);
  const i = t.indexOf(' - ');
  if (i < 0) return t;
  const left = t.slice(0, i);
  const right = t.slice(i + 3);
  if (!right.trim()) return t;
  return (
    <>
      {left} - <strong>{right}</strong>
    </>
  );
}

type HypothesisRow = { id: string; title: string; rationale: string; confidence: string };

function parseHypothesesFromProfile(raw: unknown): { hypotheses: HypothesisRow[]; updated_at?: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { hypotheses: [] };
  const o = raw as Record<string, unknown>;
  const arr = o.hypotheses;
  if (!Array.isArray(arr)) return { hypotheses: [] };
  const hypotheses: HypothesisRow[] = [];
  for (const it of arr) {
    if (!it || typeof it !== 'object' || Array.isArray(it)) continue;
    const r = it as Record<string, unknown>;
    const title = typeof r.title === 'string' ? r.title.trim() : '';
    if (!title) continue;
    hypotheses.push({
      id: typeof r.id === 'string' && r.id.trim() ? r.id.trim() : `h-${hypotheses.length}`,
      title,
      rationale: typeof r.rationale === 'string' ? r.rationale.trim() : '',
      confidence: typeof r.confidence === 'string' ? r.confidence.trim().toLowerCase() : 'low',
    });
  }
  return {
    hypotheses,
    updated_at: typeof o.updated_at === 'string' ? o.updated_at : undefined,
  };
}

function confidenceLabel(c: string) {
  const v = (c || '').toLowerCase();
  if (v === 'medium') return 'Media';
  if (v === 'high') return 'Alta';
  return 'Baja';
}

function hypothesisConfidenceChipClass(stylesMod: typeof styles, c: string): string {
  const v = (c || '').toLowerCase();
  if (v === 'high') return stylesMod.hypChipHigh;
  if (v === 'medium') return stylesMod.hypChipMedium;
  return stylesMod.hypChipLow;
}

type SignalsSubTab = 'news' | 'hypotheses';

export function KycSignalsPanel({
  companyId,
  signals,
  signalIntel,
  onRefetch,
  onBanner,
}: {
  companyId: number;
  signals: Sig[];
  signalIntel: unknown;
  onRefetch: () => void;
  onBanner: (s: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ source: 'manual', source_url: '', title: '', text: '', sentiment: '' });
  const [loadingNews, setLoadingNews] = useState(false);
  const [inferBusy, setInferBusy] = useState(false);
  const [signalsSubTab, setSignalsSubTab] = useState<SignalsSubTab>('news');

  const { hypotheses, updated_at } = parseHypothesesFromProfile(signalIntel);

  const hypothesesUpdatedLabel = useMemo(
    () =>
      updated_at
        ? new Date(updated_at).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })
        : null,
    [updated_at],
  );

  const sortedSignals = [...signals].sort((a, b) => {
    const da = Date.parse(String(a.published_at || a.captured_at || '')) || 0;
    const db = Date.parse(String(b.published_at || b.captured_at || '')) || 0;
    return db - da;
  });

  const fetchNews = async () => {
    setLoadingNews(true);
    onBanner(null);
    try {
      const r = await kycJson<{ created: number; total: number }>(`/api/kyc/companies/${companyId}/signals/fetch-news`, {
        method: 'POST',
      });
      onBanner(`Noticias: +${r.created} (de ${r.total}).`);
      onRefetch();
    } catch (e) {
      onBanner((e as Error).message);
    } finally {
      setLoadingNews(false);
    }
  };

  const inferHypotheses = async () => {
    if (!signals.length) {
      onBanner('Añade señales o busca noticias antes de generar hipótesis.');
      return;
    }
    setInferBusy(true);
    onBanner(null);
    try {
      const r = await kycJson<{ ok?: boolean; updated?: boolean; count?: number; message?: string }>(
        `/api/kyc/companies/${companyId}/signals/infer-hypotheses`,
        { method: 'POST' },
      );
      const n = Number(r?.count ?? 0);
      const msg = r?.message ? ` ${r.message}` : '';
      if (r?.updated) onBanner(`Hipótesis guardadas (${n}).${msg}`);
      else onBanner(`Hipótesis: sin cambios o sin resultado (${n}).${msg}`);
      onRefetch();
    } catch (e) {
      onBanner((e as Error).message);
    } finally {
      setInferBusy(false);
    }
  };

  const submit = async () => {
    onBanner(null);
    try {
      await kycJson(`/api/kyc/companies/${companyId}/signals`, {
        method: 'POST',
        body: JSON.stringify({
          source: f.source || 'manual',
          source_url: f.source_url || null,
          title: f.title || null,
          text: f.text || null,
          sentiment: f.sentiment || null,
        }),
      });
      setOpen(false);
      setF({ source: 'manual', source_url: '', title: '', text: '', sentiment: '' });
      onRefetch();
    } catch (e) {
      onBanner((e as Error).message);
    }
  };

  return (
    <div className={styles.signalsTabRoot}>
      <aside className={styles.signalsIntro} aria-label="Acerca del apartado Señales">
        <div className={styles.signalsIntroBadge} aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>
        <div className={styles.signalsIntroBody}>
          <p className={styles.signalsIntroKicker}>Inteligencia externa</p>
          <p className={styles.signalsIntroText}>
            Capturas automáticas y notas manuales frente a lecturas que genera la IA. Nada sustituye revisión humana antes
            de mover alcance a Proyectos o al chat KYC.
          </p>
        </div>
      </aside>

      <div className={styles.signalsSegmented} role="tablist" aria-label="Vistas de señales">
        <button
          id="kyc-signals-subtab-news"
          type="button"
          role="tab"
          aria-selected={signalsSubTab === 'news'}
          aria-controls="kyc-signals-subpanel-news"
          className={`${styles.signalsSegBtn} ${signalsSubTab === 'news' ? styles.signalsSegBtnActive : ''}`}
          onClick={() => setSignalsSubTab('news')}
        >
          <span className={styles.signalsSegLabel}>Noticias y señales</span>
          {signals.length > 0 ? <span className={styles.signalsSegBadge}>{signals.length}</span> : null}
        </button>
        <button
          id="kyc-signals-subtab-hypotheses"
          type="button"
          role="tab"
          aria-selected={signalsSubTab === 'hypotheses'}
          aria-controls="kyc-signals-subpanel-hypotheses"
          className={`${styles.signalsSegBtn} ${signalsSubTab === 'hypotheses' ? styles.signalsSegBtnActive : ''}`}
          onClick={() => setSignalsSubTab('hypotheses')}
        >
          <span className={styles.signalsSegLabel}>Hipótesis IA</span>
          {hypotheses.length > 0 ? <span className={styles.signalsSegBadge}>{hypotheses.length}</span> : null}
        </button>
      </div>

      <div className={styles.signalsPanelSurface}>
        <div
          id="kyc-signals-subpanel-news"
          role="tabpanel"
          aria-labelledby="kyc-signals-subtab-news"
          hidden={signalsSubTab !== 'news'}
          className={`${styles.signalsPanelInner} ${signalsSubTab !== 'news' ? styles.signalsPanelInnerIsHidden : ''}`}
        >
          <header className={styles.signalsToolbar}>
            <div className={styles.signalsToolbarActions}>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} onClick={() => setOpen(true)}>
                + Añadir señal
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                onClick={fetchNews}
                disabled={loadingNews}
              >
                {loadingNews ? 'Buscando…' : 'Buscar noticias'}
              </button>
            </div>
            <p className={styles.signalsToolbarMeta}>
              {signals.length === 0 ? 'Sin entradas' : `${signals.length} ${signals.length === 1 ? 'señal' : 'señales'} · ordenadas por fecha`}
            </p>
          </header>
          <p className={styles.signalsPanelHint}>
            Son contexto de mercado y prensa, no evidencia contractual; no alimentan por sí solas la lista de proyectos en
            cuenta.
          </p>
          <div className={styles.signalsFeedWrap}>
            {!signals.length ? (
              <p className={styles.signalsEmpty}>Aún no hay señales. Usa «Buscar noticias» o añade una manualmente.</p>
            ) : (
              <ul className={styles.sigList}>
                {sortedSignals.map((s) => {
                  const titleStr = String(s.title ?? '').trim();
                  const textStr = String(s.text ?? '').trim();
                  const headline = titleStr || textStr.slice(0, 280) || '—';
                  const showExpandedText =
                    Boolean(textStr && titleStr && !normalizedSignalBodyEqualsTitle(titleStr, textStr));
                  const when = s.published_at || s.captured_at;
                  const dateLabel = when
                    ? new Date(String(when)).toLocaleDateString('es', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : null;

                  return (
                    <li key={s.id} className={styles.sigItem}>
                      <div className={styles.sigItemMeta}>
                        <span className={styles.sigChipSource}>{formatSignalSource(s.source)}</span>
                        <span className={`${styles.sigChip} ${sentimentChipClass(styles, s.sentiment)}`}>{sentimentLabel(s.sentiment)}</span>
                        {dateLabel ? <span className={styles.sigChipDate}>{dateLabel}</span> : null}
                      </div>
                      <div className={styles.sigItemTitle}>
                        <DashBold text={headline} />
                      </div>
                      {showExpandedText ? (
                        <div className={styles.sigItemBody}>
                          <DashBold text={textStr} />
                        </div>
                      ) : null}
                      {s.source_url ? (
                        <div className={styles.sigItemFooter}>
                          <a className={styles.sigItemLink} href={s.source_url} target="_blank" rel="noreferrer">
                            <span>Abrir fuente original</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M15 3h6v6" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M10 14 21 3" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </a>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div
          id="kyc-signals-subpanel-hypotheses"
          role="tabpanel"
          aria-labelledby="kyc-signals-subtab-hypotheses"
          hidden={signalsSubTab !== 'hypotheses'}
          className={`${styles.signalsPanelInner} ${signalsSubTab !== 'hypotheses' ? styles.signalsPanelInnerIsHidden : ''}`}
        >
          <header className={styles.signalsToolbar}>
            <div className={styles.signalsToolbarActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                onClick={() => void inferHypotheses()}
                disabled={inferBusy || !signals.length}
                title="IA a partir de las señales listadas en «Noticias y señales» (no contrastado)"
              >
                {inferBusy ? 'Generando…' : 'Regenerar hipótesis'}
              </button>
            </div>
            <p className={styles.signalsToolbarMeta}>
              {hypothesesUpdatedLabel && updated_at ? (
                <>
                  Última generación IA:{' '}
                  <time dateTime={updated_at}>{hypothesesUpdatedLabel}</time>
                </>
              ) : (
                'Aún sin ejecución de IA en esta cuenta'
              )}
            </p>
          </header>
          <p className={styles.signalsPanelHint}>
            Conjeturas a partir del corpus de noticias y señales; no son proyectos en cuenta hasta registrarlos o
            confirmarlos en el KYC.
          </p>
          <div className={`${styles.sigHypothesisBlock} ${styles.sigHypothesisBlockEmbedded}`}>
          <div className={styles.sigHypothesisBlockHead}>
            <div>
              <h3 className={styles.sigHypothesisTitle}>Posibles iniciativas</h3>
              <p className={styles.sigHypothesisLead}>
                Lecturas posibles sobre lo que podría estar pasando en la cuenta; conviene contrastarlas en negocio.
              </p>
            </div>
            {hypotheses.length > 0 ? (
              <span className={styles.sigHypothesisCountBadge}>{hypotheses.length} hipótesis</span>
            ) : null}
          </div>
          {hypotheses.length === 0 ? (
            <p className={styles.signalsEmptySoft}>
              Cuando tengas noticias en el otro apartado, pulsa «Regenerar hipótesis».
            </p>
          ) : (
            <ul className={styles.sigHypothesisList} aria-label="Lista de hipótesis">
              {hypotheses.map((h, idx) => (
                <li
                  key={h.id}
                  className={styles.sigHypothesisItem}
                  data-confidence={h.confidence || 'low'}
                >
                  <div className={styles.sigHypothesisItemTop}>
                    <span className={styles.sigHypothesisIndex} aria-hidden="true">
                      {idx + 1}
                    </span>
                    <span
                      className={`${styles.hypChip} ${hypothesisConfidenceChipClass(styles, h.confidence)}`}
                      title="Nivel de confianza atribuido por el modelo (especulación)"
                    >
                      Confianza: {confidenceLabel(h.confidence)}
                    </span>
                  </div>
                  <h4 className={styles.sigHypothesisItemTitle}>{h.title}</h4>
                  {h.rationale ? (
                    <div className={styles.sigHypothesisRationaleWrap}>
                      <span className={styles.sigHypothesisRationaleLabel}>Por qué lo sugiere</span>
                      <p className={styles.sigHypothesisRationale}>{h.rationale}</p>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          </div>
        </div>
      </div>

      {open && (
        <div className={styles.modalOverlay} onClick={() => setOpen(false)} role="presentation">
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>Añadir señal</h2>
            <div className={styles.formRow}>
              <span className={styles.label}>Fuente</span>
              <input className={styles.input} value={f.source} onChange={(e) => setF((x) => ({ ...x, source: e.target.value }))} />
            </div>
            <div className={styles.formRow}>
              <span className={styles.label}>URL</span>
              <input className={styles.input} value={f.source_url} onChange={(e) => setF((x) => ({ ...x, source_url: e.target.value }))} />
            </div>
            <div className={styles.formRow}>
              <span className={styles.label}>Título</span>
              <input className={styles.input} value={f.title} onChange={(e) => setF((x) => ({ ...x, title: e.target.value }))} />
            </div>
            <div className={styles.formRow}>
              <span className={styles.label}>Texto</span>
              <textarea className={styles.textareaLg} value={f.text} onChange={(e) => setF((x) => ({ ...x, text: e.target.value }))} />
            </div>
            <div className={styles.formRow}>
              <span className={styles.label}>Sentimiento</span>
              <select
                className={styles.input}
                value={f.sentiment}
                onChange={(e) => setF((x) => ({ ...x, sentiment: e.target.value }))}
              >
                <option value="">—</option>
                <option value="positive">Positivo</option>
                <option value="neutral">Neutral</option>
                <option value="negative">Negativo</option>
                <option value="mixed">Mixto</option>
              </select>
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.btn} onClick={() => setOpen(false)}>
                Cancelar
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={submit}>
                Añadir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
