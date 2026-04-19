'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch, apiUpload } from '@/lib/api';
import { PageBreadcrumb, PageHero, PageBackLink, ChevronBackIcon } from '@/components/page-hero';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { useUser } from '@/contexts/UserContext';
import { MEDDPICC_DIMENSIONS, MEDDPICC_SCORE_LABELS } from '@/lib/meddpicc-dimensions';
import styles from '../meddpicc.module.css';

type Owner = { email: string; name: string | null; lastName: string | null };

type AttachmentRow = {
  id: string;
  fileName: string;
  mimeType: string;
  extractedMarkdown: string;
  sortOrder: number;
  createdAt: string;
};

type DealApi = {
  id: string;
  userId: string;
  name: string;
  company: string;
  ownerLabel: string | null;
  value: string;
  context: string | null;
  scores: Record<string, number>;
  answers: Record<string, string>;
  notes: Record<string, unknown>;
  status: string;
  updatedAt: string;
  owner?: Owner;
  attachments?: AttachmentRow[];
};

type HistoryRow = {
  id: string;
  dimension: string;
  score: number | null;
  note: string | null;
  createdAt: string;
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function emptyScores(): Record<string, number> {
  const o: Record<string, number> = {};
  for (const dim of MEDDPICC_DIMENSIONS) o[dim.key] = 0;
  return o;
}

function emptyAnswers(): Record<string, string> {
  const o: Record<string, string> = {};
  for (const dim of MEDDPICC_DIMENSIONS) {
    for (const q of dim.questions) o[q.id] = '';
  }
  return o;
}

export default function MeddpiccDealDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const router = useRouter();
  const me = useUser();
  const isAdmin = me?.role === 'ADMIN';

  const [tab, setTab] = useState<'eval' | 'ai'>('eval');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deal, setDeal] = useState<DealApi | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [ownerLabel, setOwnerLabel] = useState('');
  const [value, setValue] = useState('');
  const [context, setContext] = useState('');
  const [scores, setScores] = useState<Record<string, number>>(emptyScores);
  const [answers, setAnswers] = useState<Record<string, string>>(emptyAnswers);

  const [saveBusy, setSaveBusy] = useState(false);
  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  const [additionalCtx, setAdditionalCtx] = useState('');
  const [analyzeBusy, setAnalyzeBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState<AttachmentRow | null>(null);
  const [deleteAttachBusy, setDeleteAttachBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/meddpicc/deals/${id}`);
      if (!res.ok) {
        setError('No se pudo cargar el deal');
        return;
      }
      const data = (await res.json()) as { deal: DealApi; history: HistoryRow[] };
      const d = data.deal;
      setDeal({ ...d, attachments: d.attachments ?? [] });
      setHistory(data.history ?? []);
      setName(d.name);
      setCompany(d.company);
      setOwnerLabel(d.ownerLabel ?? '');
      setValue(d.value);
      setContext(d.context ?? '');
      const es = emptyScores();
      const mergedScores = { ...es, ...(typeof d.scores === 'object' && d.scores ? d.scores : {}) };
      setScores(mergedScores);
      const ea = emptyAnswers();
      const ans = typeof d.answers === 'object' && d.answers ? (d.answers as Record<string, string>) : {};
      setAnswers({ ...ea, ...ans });
    } catch {
      setError('Error de red');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveAll = async () => {
    if (!id) return;
    setSaveBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/meddpicc/deals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          company: company.trim(),
          ownerLabel: ownerLabel.trim() || null,
          value: value.trim(),
          context: context.trim() || null,
          scores,
          answers,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        const msg = Array.isArray(j.message) ? j.message.join(', ') : j.message;
        setError(msg || 'No se pudo guardar');
        return;
      }
      const data = (await res.json()) as { deal: DealApi };
      setDeal(data.deal);
    } catch {
      setError('Error de red');
    } finally {
      setSaveBusy(false);
    }
  };

  const runAnalyze = async () => {
    if (!id) return;
    setAnalyzeBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/meddpicc/deals/${id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ additionalContext: additionalCtx.trim() || undefined }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        const msg = Array.isArray(j.message) ? j.message.join(', ') : j.message;
        setError(msg || 'No se pudo analizar');
        return;
      }
      const data = (await res.json()) as { deal: DealApi };
      setDeal(data.deal);
      setAnalyzeOpen(false);
      setAdditionalCtx('');
      setTab('ai');
      void load();
    } catch {
      setError('Error de red');
    } finally {
      setAnalyzeBusy(false);
    }
  };

  const uploadAttachments = async (fileList: FileList | null) => {
    if (!id || !fileList?.length) return;
    setUploadBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      for (let i = 0; i < fileList.length; i++) fd.append('files', fileList[i]);
      const res = await apiUpload(`/api/meddpicc/deals/${id}/attachments`, fd);
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        const msg = Array.isArray(j.message) ? j.message.join(', ') : j.message;
        setError(msg || 'No se pudieron subir los archivos');
        return;
      }
      const data = (await res.json()) as { deal: DealApi };
      setDeal(data.deal);
    } catch {
      setError('Error de red al subir archivos');
    } finally {
      setUploadBusy(false);
    }
  };

  const confirmRemoveAttachment = async () => {
    if (!id || !attachmentToDelete) return;
    setDeleteAttachBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/meddpicc/deals/${id}/attachments/${attachmentToDelete.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        setError('No se pudo eliminar el adjunto');
        return;
      }
      const data = (await res.json()) as { deal: DealApi };
      setDeal(data.deal);
      setAttachmentToDelete(null);
    } catch {
      setError('Error de red');
    } finally {
      setDeleteAttachBusy(false);
    }
  };

  const remove = async () => {
    if (!id) return;
    setDeleteBusy(true);
    try {
      const res = await apiFetch(`/api/meddpicc/deals/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setError('No se pudo eliminar');
        return;
      }
      router.push('/launcher/meddpicc');
    } catch {
      setError('Error de red');
    } finally {
      setDeleteBusy(false);
      setDeleteOpen(false);
    }
  };

  const notes = deal?.notes ?? {};
  const aiAssessment = typeof notes.aiAssessment === 'string' ? notes.aiAssessment : '';
  const aiRisks = Array.isArray(notes.aiRisks) ? notes.aiRisks : [];
  const aiStrengths = Array.isArray(notes.aiStrengths) ? notes.aiStrengths : [];
  const aiNext = Array.isArray(notes.aiNextQuestions) ? notes.aiNextQuestions : [];
  const lastAnalysis = typeof notes.lastAnalysis === 'string' ? notes.lastAnalysis : '';

  const ownerLine = useMemo(() => {
    if (!deal?.owner) return null;
    const o = deal.owner;
    const n = [o.name, o.lastName].filter(Boolean).join(' ');
    return `${o.email}${n ? ` · ${n}` : ''}`;
  }, [deal]);

  if (loading && !deal) {
    return (
      <div className={styles.page}>
        <p className={styles.dealCardMeta}>Cargando…</p>
      </div>
    );
  }

  if (error && !deal) {
    return (
      <div className={styles.page}>
        <PageBreadcrumb>
          <PageBackLink href="/launcher/meddpicc">
            <ChevronBackIcon />
            MEDDPICC
          </PageBackLink>
        </PageBreadcrumb>
        <p className={styles.errorText}>{error}</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <PageBreadcrumb>
        <PageBackLink href="/launcher/meddpicc">
          <ChevronBackIcon />
          MEDDPICC
        </PageBackLink>
      </PageBreadcrumb>
      <PageHero
        title={deal?.name ?? 'Deal'}
        subtitle={
          ownerLine && isAdmin ? (
            <>
              Propietario: <strong>{ownerLine}</strong>
            </>
          ) : (
            'Evaluación por dimensiones y análisis con IA usando la clave Anthropic de tu perfil.'
          )
        }
      />

      {error && (
        <p className={styles.errorText} style={{ marginTop: 'var(--fiori-space-3)' }}>
          {error}
        </p>
      )}

      <div className={styles.detailHeader}>
        <div className={styles.formGrid}>
          <div>
            <label className={styles.fieldLabel} htmlFor="ed-name">
              Nombre
            </label>
            <input id="ed-name" className={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className={styles.fieldLabel} htmlFor="ed-co">
              Empresa
            </label>
            <input id="ed-co" className={styles.input} value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>
          <div>
            <label className={styles.fieldLabel} htmlFor="ed-ol">
              Comercial (etiqueta)
            </label>
            <input id="ed-ol" className={styles.input} value={ownerLabel} onChange={(e) => setOwnerLabel(e.target.value)} />
          </div>
          <div>
            <label className={styles.fieldLabel} htmlFor="ed-val">
              Valor
            </label>
            <input id="ed-val" className={styles.input} value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 'var(--fiori-space-3)' }}>
          <label className={styles.fieldLabel} htmlFor="ed-ctx">
            Contexto del deal
          </label>
          <textarea id="ed-ctx" className={styles.textarea} rows={6} value={context} onChange={(e) => setContext(e.target.value)} />
        </div>

        <div className={styles.attachSection}>
          <p className={styles.attachHint}>
            Adjunta PDF, Excel (.xlsx, .xls), Word (.docx) o correo (.eml). El contenido se extrae a Markdown y se incluye
            junto al texto anterior en el análisis IA (hasta 25 adjuntos por deal, 25 MB por archivo).
          </p>
          <div className={styles.attachRow}>
            <input
              className={styles.fileInput}
              type="file"
              multiple
              accept=".pdf,.xlsx,.xls,.xlsm,.docx,.eml,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document,message/rfc822"
              disabled={uploadBusy}
              onChange={(e) => {
                const list = e.target.files;
                void uploadAttachments(list);
                e.target.value = '';
              }}
            />
            {uploadBusy && <span className={styles.dealCardMeta}>Subiendo y extrayendo texto…</span>}
          </div>
          {(deal?.attachments?.length ?? 0) > 0 && (
            <ul className={styles.attachList}>
              {(deal?.attachments ?? []).map((a) => (
                <li key={a.id} className={styles.attachItem}>
                  <div className={styles.attachItemHead}>
                    <p className={styles.attachItemName}>{a.fileName}</p>
                    <button
                      type="button"
                      className={styles.removeAttachBtn}
                      disabled={uploadBusy || deleteAttachBusy}
                      onClick={() => setAttachmentToDelete(a)}
                    >
                      Quitar
                    </button>
                  </div>
                  <p className={styles.attachItemMeta}>
                    {a.mimeType} · {formatDate(a.createdAt)}
                  </p>
                  <pre className={styles.mdPreview}>{a.extractedMarkdown}</pre>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={styles.aiBar}>
        <div>
          <strong>Análisis IA</strong>
          {lastAnalysis ? (
            <p className={styles.dealCardMeta} style={{ margin: '0.25rem 0 0' }}>
              Último: {formatDate(lastAnalysis)}
            </p>
          ) : (
            <p className={styles.dealCardMeta} style={{ margin: '0.25rem 0 0' }}>
              Se usa la clave Anthropic guardada en tu perfil.
            </p>
          )}
        </div>
        <button type="button" className={styles.primaryBtn} onClick={() => setAnalyzeOpen(true)}>
          Analizar con IA
        </button>
      </div>

      <div className={styles.tabs}>
        <button type="button" className={`${styles.tab} ${tab === 'eval' ? styles.tabActive : ''}`} onClick={() => setTab('eval')}>
          Evaluación
        </button>
        <button type="button" className={`${styles.tab} ${tab === 'ai' ? styles.tabActive : ''}`} onClick={() => setTab('ai')}>
          Resumen IA
        </button>
      </div>

      {tab === 'eval' && (
        <>
          {MEDDPICC_DIMENSIONS.map((dim) => (
            <section key={dim.key} className={styles.dimCard} style={{ borderLeft: `4px solid ${dim.color}` }}>
              <div className={styles.dimHead}>
                <span aria-hidden>{dim.icon}</span>
                <h2 className={styles.detailTitle} style={{ margin: 0, fontSize: '1.05rem' }}>
                  {dim.name}
                </h2>
                <label className={styles.fieldLabel} htmlFor={`sc-${dim.key}`} style={{ marginLeft: 'auto' }}>
                  Score (0–10)
                </label>
                <input
                  id={`sc-${dim.key}`}
                  type="number"
                  min={0}
                  max={10}
                  className={`${styles.input} ${styles.dimScore}`}
                  value={scores[dim.key] ?? 0}
                  onChange={(e) => {
                    const v = Math.min(10, Math.max(0, parseInt(e.target.value, 10) || 0));
                    setScores((s) => ({ ...s, [dim.key]: v }));
                  }}
                />
              </div>
              <p className={styles.scoreHint}>{dim.description}</p>
              {dim.questions.map((q) => (
                <div key={q.id} className={styles.questionBlock}>
                  <p className={styles.questionLabel}>{q.q}</p>
                  <p className={styles.questionHint}>{q.hint}</p>
                  <textarea
                    className={styles.textarea}
                    rows={3}
                    value={answers[q.id] ?? ''}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  />
                </div>
              ))}
            </section>
          ))}

          <div className={styles.toolbar}>
            <button type="button" className={styles.primaryBtn} disabled={saveBusy} onClick={() => void saveAll()}>
              {saveBusy ? 'Guardando…' : 'Guardar cambios'}
            </button>
            <button type="button" className={`${styles.ghostBtn} ${styles.dangerBtn}`} onClick={() => setDeleteOpen(true)}>
              Eliminar deal
            </button>
          </div>

          {history.length > 0 && (
            <div className={styles.aiBlock}>
              <h3>Historial de puntuaciones</h3>
              <ul className={styles.historyList}>
                {history.map((h) => (
                  <li key={h.id} className={styles.historyItem}>
                    {formatDate(h.createdAt)} — <strong>{h.dimension}</strong>
                    {h.score != null ? `: ${h.score}/10` : ''}
                    {h.note ? ` · ${h.note}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {tab === 'ai' && (
        <>
          <div className={styles.aiBlock}>
            <h3>Valoración global</h3>
            <p>{aiAssessment || 'Aún no hay análisis. Ejecuta «Analizar con IA» desde la pestaña Evaluación.'}</p>
          </div>
          {aiStrengths.length > 0 && (
            <div className={styles.aiBlock}>
              <h3>Fortalezas</h3>
              <ul className={styles.listPlain}>
                {aiStrengths.map((x, i) => (
                  <li key={i}>{String(x)}</li>
                ))}
              </ul>
            </div>
          )}
          {aiRisks.length > 0 && (
            <div className={styles.aiBlock}>
              <h3>Riesgos</h3>
              <ul className={styles.listPlain}>
                {aiRisks.map((x, i) => (
                  <li key={i}>{String(x)}</li>
                ))}
              </ul>
            </div>
          )}
          {aiNext.length > 0 && (
            <div className={styles.aiBlock}>
              <h3>Próximas preguntas sugeridas</h3>
              <ul className={styles.listPlain}>
                {aiNext.map((x, i) => (
                  <li key={i}>{String(x)}</li>
                ))}
              </ul>
            </div>
          )}
          <p className={styles.dealCardMeta}>
            Escala de referencia por score: {MEDDPICC_SCORE_LABELS[5]} (5) = punto medio.
          </p>
        </>
      )}

      {analyzeOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgb(0 0 0 / 35%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !analyzeBusy) setAnalyzeOpen(false);
          }}
        >
          <div
            className={styles.dimCard}
            style={{ maxWidth: '32rem', width: '100%' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="analyze-title"
          >
            <h2 id="analyze-title" className={styles.detailTitle}>
              Analizar con IA
            </h2>
            <p className={styles.dealCardMeta}>Añade contexto opcional (reunión, emails) para reevaluar el deal.</p>
            <textarea
              className={styles.textarea}
              rows={6}
              value={additionalCtx}
              onChange={(e) => setAdditionalCtx(e.target.value)}
              placeholder="Notas adicionales…"
            />
            <div className={styles.toolbar}>
              <button type="button" className={styles.primaryBtn} disabled={analyzeBusy} onClick={() => void runAnalyze()}>
                {analyzeBusy ? 'Analizando…' : 'Ejecutar análisis'}
              </button>
              <button type="button" className={styles.ghostBtn} disabled={analyzeBusy} onClick={() => setAnalyzeOpen(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteOpen}
        title="Eliminar deal"
        message="Se eliminará este deal y su historial. Esta acción no se puede deshacer."
        variant="danger"
        confirmBusy={deleteBusy}
        onConfirm={() => void remove()}
        onCancel={() => !deleteBusy && setDeleteOpen(false)}
      />

      <ConfirmDialog
        open={attachmentToDelete != null}
        title="Quitar adjunto"
        message={
          attachmentToDelete
            ? `Se eliminará «${attachmentToDelete.fileName}» del contexto. ¿Continuar?`
            : ''
        }
        confirmBusy={deleteAttachBusy}
        onConfirm={() => void confirmRemoveAttachment()}
        onCancel={() => !deleteAttachBusy && setAttachmentToDelete(null)}
      />
    </div>
  );
}
