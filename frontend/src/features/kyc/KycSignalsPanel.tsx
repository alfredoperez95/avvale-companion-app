'use client';

import { useState } from 'react';
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
  if (!v) return '—';
  if (v === 'positive') return 'Positivo';
  if (v === 'neutral') return 'Neutral';
  if (v === 'negative') return 'Negativo';
  if (v === 'mixed') return 'Mixto';
  return s || '—';
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

  const { hypotheses, updated_at } = parseHypothesesFromProfile(signalIntel);

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
    <div>
      <p className={styles.hint} style={{ marginBottom: '0.75rem', maxWidth: '44rem' }}>
        Las noticias y RSS son señales, no pruebas: no alimentan por sí solas el listado de proyectos en cuenta. La
        sección inferior recoge hipótesis generadas por IA a partir de estas señales; valídalas antes de pasarlas a
        Proyectos o al chat KYC.
      </p>
      <div className={styles.row} style={{ marginBottom: '0.75rem' }}>
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
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
          onClick={() => void inferHypotheses()}
          disabled={inferBusy || !signals.length}
          title="IA a partir de las señales listadas (no contrastado)"
        >
          {inferBusy ? 'Generando…' : 'Regenerar hipótesis desde señales'}
        </button>
      </div>
      <ul className={styles.sigList}>
        {sortedSignals.map((s) => (
          <li key={s.id} className={styles.sigItem}>
            <div className={styles.hint} style={{ margin: 0, fontSize: '0.65rem' }}>
              {s.source} · {sentimentLabel(s.sentiment)}
              {(s.published_at || s.captured_at) ? ` · ${new Date(String(s.published_at || s.captured_at)).toLocaleDateString()}` : ''}
            </div>
            <div className={styles.sigTitle}>
              <DashBold text={String(s.title || s.text?.slice(0, 200) || '—')} />
            </div>
            {s.text && s.title && (
              <div className={styles.hint} style={{ margin: '0.2rem 0 0' }}>
                <DashBold text={String(s.text)} />
              </div>
            )}
            {s.source_url ? (
              <a className={styles.linkUrl} href={s.source_url} target="_blank" rel="noreferrer">
                Enlace
              </a>
            ) : null}
          </li>
        ))}
        {!signals.length && <p className={styles.hint}>Aún no hay señales.</p>}
      </ul>

      <div className={styles.sigHypothesisBlock}>
        <h3 className={styles.sigHypothesisTitle}>Posibles iniciativas (hipótesis)</h3>
        <p className={styles.hint} style={{ margin: '0.25rem 0 0.65rem' }}>
          Conjeturas a partir de noticias y señales; no son proyectos en cuenta hasta que los registres en la pestaña
          Proyectos o los confirmes en el KYC.
          {updated_at ? ` Última generación: ${new Date(updated_at).toLocaleString()}.` : ''}
        </p>
        {hypotheses.length === 0 ? (
          <p className={styles.hint}>Pulsa «Regenerar hipótesis desde señales» cuando tengas noticias o señales cargadas.</p>
        ) : (
          <ul className={styles.sigHypothesisList}>
            {hypotheses.map((h) => (
              <li key={h.id} className={styles.sigHypothesisItem}>
                <div className={styles.sigHypothesisMeta}>
                  Confianza (especulación): {confidenceLabel(h.confidence)}
                </div>
                <div className={styles.sigTitle}>{h.title}</div>
                {h.rationale ? (
                  <p className={styles.sigHypothesisRationale}>{h.rationale}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
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
