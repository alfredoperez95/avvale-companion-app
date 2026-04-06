'use client';

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { PageBreadcrumb, PageHero, PageBackLink, ChevronBackIcon } from '@/components/page-hero';
import { RfqStatusTag } from '@/components/RfqStatusTag/RfqStatusTag';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { RfqAssistantMessageBody } from '../RfqAssistantMessageBody';
import styles from '../rfq-analysis.module.css';

type Source = {
  id: string;
  kind: string;
  fileName: string | null;
  mimeType: string | null;
  extractionStatus: string;
  extractionError: string | null;
};

type Insight = {
  executiveSummary: string | null;
  opportunityType: string | null;
  detectedTechnologies: unknown;
  avvaleAreas: unknown;
  functionalVision: string | null;
  technicalVision: string | null;
  risksAndUnknowns: string | null;
  recommendedQuestions: unknown;
  confidenceNotes: string | null;
};

type Message = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

type Detail = {
  id: string;
  title: string;
  status: string;
  sourceType: string;
  manualContext: string | null;
  originEmail: string | null;
  originSubject: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  sources: Source[];
  insights: Insight[];
  messages: Message[];
};

function formatJsonList(val: unknown): string {
  if (val == null) return '—';
  if (Array.isArray(val)) {
    return val
      .map((x) => {
        if (typeof x === 'string') return x;
        if (x && typeof x === 'object' && 'name' in x) return String((x as { name: unknown }).name);
        try {
          return JSON.stringify(x);
        } catch {
          return String(x);
        }
      })
      .join(', ');
  }
  return String(val);
}

const CONFIDENCE_ES: Record<string, string> = {
  alta: 'Confianza alta',
  media: 'Confianza media',
  baja: 'Confianza baja',
};

/**
 * Nuevo formato: [{ unit, rationale, confidence }]. Legacy: strings o texto libre.
 */
function AvvaleAreasContent({ value }: { value: unknown }) {
  if (value == null) {
    return <p className={styles.avvaleLegacyText}>—</p>;
  }
  if (!Array.isArray(value) || value.length === 0) {
    return <p className={styles.avvaleLegacyText}>—</p>;
  }

  const first = value[0];
  const looksStructured =
    typeof first === 'object' &&
    first !== null &&
    ('unit' in first || 'suggestedUnit' in first);

  if (!looksStructured) {
    const s = formatJsonList(value);
    if (s === '—') {
      return <p className={styles.avvaleLegacyText}>—</p>;
    }
    const parts = s
      .split(/,\s*/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (parts.length <= 1) {
      return <p className={styles.avvaleLegacyText}>{s}</p>;
    }
    return (
      <ul className={styles.avvaleChipList} role="list">
        {parts.map((p, i) => (
          <li key={i} className={styles.avvaleChip}>
            {p}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={styles.avvaleAreasList}>
      {value.map((raw, i) => {
        const o = raw as Record<string, unknown>;
        const unitRaw = o.unit ?? o.suggestedUnit;
        const unit = typeof unitRaw === 'string' ? unitRaw.toUpperCase() : '';
        const rationale =
          typeof o.rationale === 'string'
            ? o.rationale
            : typeof o.notes === 'string'
              ? o.notes
              : typeof o.description === 'string'
                ? o.description
                : '';
        const confRaw = typeof o.confidence === 'string' ? o.confidence.toLowerCase() : '';
        const confLabel = confRaw ? CONFIDENCE_ES[confRaw] ?? o.confidence : '';

        const unitKey = unit || 'UNKNOWN';
        return (
          <div key={i} className={styles.avvaleUnitCard} data-unit={unitKey}>
            <div className={styles.avvaleUnitHeader}>
              <div className={styles.avvaleParticipantTags} role="group" aria-label={`Unidad ${unit || '—'} en esta oportunidad`}>
                <span
                  className={styles.avvaleUnitBadge}
                  data-unit={unitKey}
                  title={`Unidad Avvale: ${unit || '—'}`}
                >
                  {unit || '—'}
                </span>
                <span className={styles.avvaleParticipatesBadge}>Participa</span>
              </div>
              {confLabel ? (
                <span className={styles.avvaleConfidencePill}>{confLabel}</span>
              ) : null}
            </div>
            <p className={styles.avvaleUnitRationale}>{rationale.trim() || '—'}</p>
          </div>
        );
      })}
    </div>
  );
}

function sourceKindLabel(kind: string): string {
  const m: Record<string, string> = {
    FILE: 'Archivo',
    EMAIL_BODY: 'Cuerpo del email',
    THREAD_CONTEXT: 'Hilo de correo',
    MANUAL_NOTE: 'Nota manual',
  };
  return m[kind] ?? kind;
}

/** Etiqueta en la columna Tipo: para adjuntos, PDF / Excel / Word / Imagen… según MIME o extensión. */
function fileFormatBadgeLabel(mimeType: string | null, fileName: string | null): string {
  const mt = (mimeType ?? '').toLowerCase().trim();
  if (mt === 'application/pdf' || mt.includes('pdf')) return 'PDF';
  if (
    mt === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mt === 'application/vnd.ms-excel' ||
    mt.includes('spreadsheet')
  ) {
    return 'Excel';
  }
  if (
    mt === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mt === 'application/msword' ||
    mt.includes('wordprocessing')
  ) {
    return 'Word';
  }
  if (
    mt === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    mt === 'application/vnd.ms-powerpoint' ||
    mt.includes('presentation') ||
    mt.includes('powerpoint')
  ) {
    return 'PowerPoint';
  }
  if (mt.startsWith('image/')) {
    if (mt.includes('png')) return 'Imagen (PNG)';
    if (mt.includes('jpeg') || mt.includes('jpg')) return 'Imagen (JPEG)';
    if (mt.includes('gif')) return 'Imagen (GIF)';
    if (mt.includes('webp')) return 'Imagen (WebP)';
    if (mt.includes('svg')) return 'Imagen (SVG)';
    return 'Imagen';
  }
  if (mt === 'text/csv' || mt.includes('csv')) return 'CSV';
  if (mt === 'text/plain' || (mt.startsWith('text/') && !mt.includes('html'))) return 'Texto';
  if (mt.includes('json')) return 'JSON';
  if (mt.includes('xml')) return 'XML';
  if (mt.includes('zip') || mt.includes('compressed')) return 'ZIP';

  const base = (fileName ?? '').toLowerCase().trim();
  const dot = base.lastIndexOf('.');
  const ext = dot >= 0 ? base.slice(dot) : '';
  const byExt: Record<string, string> = {
    '.pdf': 'PDF',
    '.xlsx': 'Excel',
    '.xls': 'Excel',
    '.xlsm': 'Excel',
    '.csv': 'CSV',
    '.docx': 'Word',
    '.doc': 'Word',
    '.pptx': 'PowerPoint',
    '.ppt': 'PowerPoint',
    '.png': 'Imagen (PNG)',
    '.jpg': 'Imagen (JPEG)',
    '.jpeg': 'Imagen (JPEG)',
    '.gif': 'Imagen (GIF)',
    '.webp': 'Imagen (WebP)',
    '.svg': 'Imagen (SVG)',
    '.txt': 'Texto',
    '.json': 'JSON',
    '.xml': 'XML',
    '.zip': 'ZIP',
  };
  if (ext && byExt[ext]) return byExt[ext];

  return 'Archivo';
}

function sourceTypeBadgeLabel(s: Source): string {
  if (s.kind !== 'FILE') return sourceKindLabel(s.kind);
  return fileFormatBadgeLabel(s.mimeType, s.fileName);
}

/** Icono sobrio (sobre) para la fuente «hilo de correo», alineado con el estilo del resto de la app. */
function MailThreadGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SourceKindBadge({ s }: { s: Source }) {
  const label = sourceTypeBadgeLabel(s);
  if (s.kind === 'THREAD_CONTEXT') {
    return (
      <span className={styles.sourceKind} title="Contexto del hilo de correo">
        <MailThreadGlyph className={styles.sourceKindIcon} />
        {label}
      </span>
    );
  }
  return <span className={styles.sourceKind}>{label}</span>;
}

/** Archivos sin extracción OK no entran en el contexto del modelo; el resto sí. */
function isSourceFileOutOfContext(s: Source): boolean {
  return s.kind === 'FILE' && s.extractionStatus !== 'OK';
}

function shortId(id: string): string {
  if (id.length <= 13) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

function extractAvvaleUnitCodes(value: unknown): string[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length === 0) return [];
  const first = value[0];
  const looksStructured =
    typeof first === 'object' &&
    first !== null &&
    ('unit' in first || 'suggestedUnit' in first);
  if (!looksStructured) return [];
  const seen = new Set<string>();
  for (const raw of value) {
    const o = raw as Record<string, unknown>;
    const u = o.unit ?? o.suggestedUnit;
    if (typeof u === 'string' && u.trim()) seen.add(u.trim().toUpperCase());
  }
  return Array.from(seen);
}

function AvvaleAreaPreviewTags({ units }: { units: string[] }) {
  if (units.length === 0) return null;
  return (
    <ul className={styles.avvalePreviewTagList} role="list" aria-label="Vista previa de unidades detectadas">
      {units.map((u) => (
        <li key={u} className={styles.avvalePreviewTagItem}>
          <span className={`${styles.avvaleUnitBadge} ${styles.avvalePreviewTag}`} data-unit={u}>
            {u}
          </span>
        </li>
      ))}
    </ul>
  );
}

function InsightPanel({
  title,
  preview,
  defaultOpen,
  badge,
  children,
}: {
  title: string;
  preview?: ReactNode;
  defaultOpen?: boolean;
  badge?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <details
      className={styles.insightDetails}
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className={styles.insightSummary}>
        <div className={styles.insightSummaryLead}>
          <span className={styles.insightSummaryTitle}>{title}</span>
          {preview}
        </div>
        {badge ? <span className={styles.insightSummaryBadge}>{badge}</span> : null}
        <span className={styles.insightSummaryChevron} aria-hidden />
      </summary>
      {children}
    </details>
  );
}

function TechStackChips({ value }: { value: unknown }) {
  const flat = formatJsonList(value);
  if (flat === '—') {
    return <p className={`${styles.insightBody} ${styles.insightProse}`}>—</p>;
  }
  const parts = flat.split(/,\s*/).map((s) => s.trim()).filter(Boolean);
  return (
    <ul className={styles.techChipList} role="list">
      {parts.map((p, i) => (
        <li key={i} className={styles.techChip}>
          {p}
        </li>
      ))}
    </ul>
  );
}

function splitNumberedInsightBlocks(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  const parts = t
    .split(/\s+(?=\d+\.\s)/)
    .map((s) => s.replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean);
  return parts.length ? parts : [t];
}

function RisksInsightContent({ text }: { text: string | null }) {
  if (!text?.trim()) {
    return <p className={`${styles.insightBody} ${styles.insightProse}`}>—</p>;
  }
  const items = splitNumberedInsightBlocks(text);
  if (items.length <= 1) {
    return <p className={`${styles.insightBody} ${styles.insightProse}`}>{text}</p>;
  }
  return (
    <ol className={styles.risksList}>
      {items.map((item, i) => (
        <li key={i} className={styles.risksListItem}>
          <span className={styles.risksListText}>{item}</span>
        </li>
      ))}
    </ol>
  );
}

function normalizeRecommendedQuestions(val: unknown): string[] {
  if (val == null) return [];
  if (Array.isArray(val)) {
    return val
      .map((x) => {
        if (typeof x === 'string') return x.trim();
        if (x && typeof x === 'object' && 'question' in x) {
          return String((x as { question: unknown }).question).trim();
        }
        if (x && typeof x === 'object' && 'text' in x) {
          return String((x as { text: unknown }).text).trim();
        }
        return '';
      })
      .filter(Boolean);
  }
  if (typeof val === 'string') {
    const s = val.trim();
    if (!s) return [];
    const byNewline = s
      .split(/\n+/)
      .map((l) => l.replace(/^\s*[\d]+[\.\)]\s+/, '').trim())
      .filter(Boolean);
    if (byNewline.length > 1) return byNewline;
    const bySemi = s.split(/\s*;\s*/).map((x) => x.trim()).filter(Boolean);
    if (bySemi.length > 1) return bySemi;
    return [s];
  }
  return [];
}

function RecommendedQuestionsTable({
  analysisId,
  value,
  onUpdated,
}: {
  analysisId: string;
  value: unknown;
  onUpdated: () => void | Promise<void>;
}) {
  const items = useMemo(() => normalizeRecommendedQuestions(value), [value]);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const removeAt = async (index: number) => {
    setLocalError(null);
    const next = items.filter((_, i) => i !== index);
    setBusy(true);
    try {
      const res = await apiFetch(`/api/rfq-analyses/${analysisId}/recommended-questions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: next }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'No se pudo actualizar las preguntas');
      }
      await onUpdated();
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setBusy(false);
    }
  };

  if (items.length === 0) {
    return <p className={styles.insightBody}>—</p>;
  }

  return (
    <div className={styles.recommendedTableWrap}>
      {localError ? <div className={styles.recommendedTableError}>{localError}</div> : null}
      <table className={styles.recommendedTable}>
        <thead>
          <tr>
            <th scope="col" className={styles.recommendedTableThNum}>
              #
            </th>
            <th scope="col">Pregunta</th>
            <th scope="col" className={styles.recommendedTableThAction}>
              <span className={styles.visuallyHidden}>Acción</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((q, i) => (
            <tr key={`${i}-${q.slice(0, 40)}`}>
              <td className={styles.recommendedTableTdNum}>{i + 1}</td>
              <td className={styles.recommendedTableTdQ}>{q}</td>
              <td className={styles.recommendedTableTdAction}>
                <button
                  type="button"
                  className={styles.recommendedRemoveBtn}
                  disabled={busy}
                  onClick={() => void removeAt(i)}
                  aria-label={`Quitar la pregunta ${i + 1} de la lista`}
                >
                  Quitar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatMessageTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function RfqAnalysisDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : '';
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [resendEmailBusy, setResendEmailBusy] = useState(false);
  const [resendEmailOk, setResendEmailOk] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const res = await apiFetch(`/api/rfq-analyses/${id}`);
    if (res.status === 404) {
      setNotFound(true);
      setDetail(null);
      setError(null);
      return;
    }
    if (!res.ok) {
      setError('No se pudo cargar el análisis');
      setDetail(null);
      return;
    }
    const data = (await res.json()) as Detail;
    setDetail(data);
    setNotFound(false);
    setError(null);
    setResendEmailOk(null);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    if (!id || notFound) return;
    const st = detail?.status;
    if (!st || st === 'COMPLETED' || st === 'FAILED' || st === 'REJECTED' || st === 'DRAFT') {
      return;
    }
    const t = setInterval(() => void load(), 3500);
    return () => clearInterval(t);
  }, [id, load, notFound, detail?.status]);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [detail?.messages?.length, chatBusy]);

  const sendChat = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!id || !chatInput.trim() || !detail || detail.status !== 'COMPLETED') return;
    setChatBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/rfq-analyses/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: chatInput.trim() }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'No se pudo enviar el mensaje');
      }
      setChatInput('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en el chat');
    } finally {
      setChatBusy(false);
    }
  };

  const resendCompletionEmail = async () => {
    if (!id || detail?.status !== 'COMPLETED') return;
    setResendEmailBusy(true);
    setResendEmailOk(null);
    setError(null);
    try {
      const res = await apiFetch(`/api/rfq-analyses/${id}/resend-completion-email`, { method: 'POST' });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'No se pudo enviar el correo de prueba');
      }
      setResendEmailOk(
        'Solicitud enviada. Si SMTP está configurado y MAIL_SKIP_SEND no está activo, revisa la bandeja del email de tu cuenta.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al reenviar el correo');
    } finally {
      setResendEmailBusy(false);
    }
  };

  const deleteAnalysis = async () => {
    if (!id) return;
    setDeleteBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/rfq-analyses/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'No se pudo eliminar el análisis');
      }
      setDeleteOpen(false);
      router.push('/launcher/rfq-analysis');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeleteBusy(false);
    }
  };

  const insight = detail?.insights?.[0];

  const { sourcesInContext, sourcesNotInContext } = useMemo(() => {
    const list = detail?.sources ?? [];
    const notIn = list.filter(isSourceFileOutOfContext);
    const inCtx = list.filter((s) => !isSourceFileOutOfContext(s));
    return { sourcesInContext: inCtx, sourcesNotInContext: notIn };
  }, [detail?.sources]);

  const section = (title: string, children: React.ReactNode) => (
    <section className={styles.sectionCard} aria-label={title}>
      <h2 className={styles.sectionHeading}>{title}</h2>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );

  if (loading && !detail && !notFound) {
    return (
      <main className={styles.page}>
        <p className={styles.loadingState}>Cargando análisis…</p>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className={styles.page}>
        <PageBreadcrumb>
          <PageBackLink href="/launcher/rfq-analysis">
            <ChevronBackIcon />
            Análisis RFQs
          </PageBackLink>
        </PageBreadcrumb>
        <p className={styles.notFound}>Análisis no encontrado o sin permiso.</p>
      </main>
    );
  }

  if (!detail) {
    return (
      <main className={styles.page}>
        <PageBreadcrumb>
          <PageBackLink href="/launcher/rfq-analysis">
            <ChevronBackIcon />
            Análisis RFQs
          </PageBackLink>
        </PageBreadcrumb>
        {error && <div className={styles.errorBox}>{error}</div>}
      </main>
    );
  }

  const busy = detail.status === 'QUEUED' || detail.status === 'PROCESSING';

  return (
    <main className={styles.page}>
      <PageBreadcrumb>
        <PageBackLink href="/launcher/rfq-analysis">
          <ChevronBackIcon />
          Análisis RFQs
        </PageBackLink>
      </PageBreadcrumb>

      <PageHero
        title={detail.title}
        subtitle={
          <div className={styles.heroSubtitle}>
            <span className={styles.idMono}>{shortId(detail.id)}</span>
            {' · '}
            Creado {new Date(detail.createdAt).toLocaleString()}
            {' · '}
            Actualizado {new Date(detail.updatedAt).toLocaleString()}
          </div>
        }
        actions={
          <div className={styles.heroActionsRow}>
            <RfqStatusTag status={detail.status} />
            {detail.status === 'COMPLETED' ? (
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={resendEmailBusy}
                onClick={() => void resendCompletionEmail()}
                title="Reenvía el correo de análisis completado (misma plantilla que al terminar el pipeline)"
              >
                {resendEmailBusy ? 'Enviando correo…' : 'Probar correo completado'}
              </button>
            ) : null}
            <button
              type="button"
              className={styles.dangerBtn}
              disabled={deleteBusy}
              onClick={() => setDeleteOpen(true)}
            >
              Eliminar análisis
            </button>
          </div>
        }
      />

      {error && <div className={styles.errorBox}>{error}</div>}
      {resendEmailOk ? (
        <div className={styles.successHint} role="status">
          {resendEmailOk}
        </div>
      ) : null}

      <div className={styles.detailLayout}>
        {busy && (
          <div className={styles.processingHint} role="status">
            <span className={styles.inlineSpinner} aria-hidden />
            Generando el análisis estructurado en segundo plano. Puedes seguir en esta página; se actualiza sola.
          </div>
        )}

        {section(
          'Resumen del workspace',
          <dl className={styles.kvList}>
            <div className={styles.kvRow}>
              <dt className={styles.kvDt}>Identificador</dt>
              <dd className={`${styles.kvDd} ${styles.idMono}`}>{detail.id}</dd>
            </div>
            <div className={styles.kvRow}>
              <dt className={styles.kvDt}>Origen</dt>
              <dd className={styles.kvDd}>
                {detail.sourceType === 'EMAIL' ? 'Correo (Make / buzón)' : 'Creado en la app'}
              </dd>
            </div>
            {detail.originEmail ? (
              <div className={styles.kvRow}>
                <dt className={styles.kvDt}>Remitente</dt>
                <dd className={styles.kvDd}>{detail.originEmail}</dd>
              </div>
            ) : null}
            {detail.originSubject ? (
              <div className={styles.kvRow}>
                <dt className={styles.kvDt}>Asunto</dt>
                <dd className={styles.kvDd}>{detail.originSubject}</dd>
              </div>
            ) : null}
            {detail.manualContext?.trim() ? (
              <div className={styles.kvRow}>
                <dt className={styles.kvDt}>Contexto manual</dt>
                <dd className={styles.kvDd} style={{ whiteSpace: 'pre-wrap' }}>
                  {detail.manualContext}
                </dd>
              </div>
            ) : null}
          </dl>,
        )}

        {detail.failureReason ? (
          <section className={styles.sectionCard} aria-label="Error">
            <h2 className={styles.sectionHeading}>Incidencia</h2>
            <div className={styles.sectionBody}>
              <p className={styles.errorBox} style={{ margin: 0 }}>
                {detail.failureReason}
              </p>
            </div>
          </section>
        ) : null}

        {section(
          'Fuentes de entrada',
          detail.sources.length === 0 ? (
            <p className={styles.emptyHint}>No hay fuentes registradas para este análisis.</p>
          ) : (
            <>
              {sourcesNotInContext.length > 0 && sourcesInContext.length > 0 ? (
                <p className={styles.sourcesContextLead}>
                  La tabla siguiente solo incluye fuentes cuyo texto entra en el contexto del análisis. Los adjuntos
                  recibidos sin texto extraíble van en el apartado plegable.
                </p>
              ) : null}
              {sourcesInContext.length > 0 ? (
                <div className={styles.sourceTableWrap}>
                  <table className={styles.sourceTable}>
                    <thead>
                      <tr>
                        <th scope="col">Tipo</th>
                        <th scope="col">Nombre / contenido</th>
                        <th scope="col">Extracción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sourcesInContext.map((s) => (
                        <tr key={s.id}>
                          <td className={styles.sourceTypeCell}>
                            <SourceKindBadge s={s} />
                          </td>
                          <td className={styles.sourceNameCell}>
                            {s.fileName ?? '—'}
                            {s.extractionError ? (
                              <div className={styles.extractionErrorDetail}>{s.extractionError}</div>
                            ) : null}
                          </td>
                          <td className={styles.sourceStatusCell}>
                            <span
                              className={
                                s.extractionStatus === 'OK' ? styles.extractionOk : styles.extractionBad
                              }
                            >
                              {s.extractionStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className={styles.emptyHint}>
                  {sourcesNotInContext.length > 0
                    ? 'Ninguna fuente de este análisis aporta texto al contexto del modelo (p. ej. solo adjuntos no extraíbles). Revisa el apartado inferior para confirmar qué archivos han llegado.'
                    : 'No hay fuentes en contexto.'}
                </p>
              )}
              {sourcesNotInContext.length > 0 ? (
                <details
                  className={styles.sourcesNotInContextDetails}
                  aria-label="Datos no recogidos en el contexto del análisis"
                >
                  <summary className={styles.sourcesNotInContextSummary}>
                    Datos no recogidos en el contexto
                    <span className={styles.sourcesNotInContextCount}>({sourcesNotInContext.length})</span>
                  </summary>
                  <p className={styles.sourcesNotInContextHelp}>
                    Estos adjuntos se han recibido y guardado en el análisis; no aportan texto al modelo (imágenes,
                    formatos no soportados aún u otras causas). Sirve para comprobar que el envío llegó completo.
                  </p>
                  <div className={styles.sourceTableWrap}>
                    <table className={styles.sourceTable}>
                      <thead>
                        <tr>
                          <th scope="col">Tipo</th>
                          <th scope="col">Nombre</th>
                          <th scope="col">Adjunto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sourcesNotInContext.map((s) => (
                          <tr key={s.id}>
                            <td className={styles.sourceTypeCell}>
                              <SourceKindBadge s={s} />
                            </td>
                            <td className={styles.sourceNameCell}>
                              {s.fileName ?? '—'}
                              {s.mimeType ? (
                                <div className={styles.sourceMimeHint}>{s.mimeType}</div>
                              ) : null}
                              {s.extractionError ? (
                                <div className={styles.extractionOutOfContextNote}>{s.extractionError}</div>
                              ) : null}
                            </td>
                            <td className={styles.sourceStatusCell}>
                              <span className={styles.attachmentReceivedBadge}>Recibido</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ) : null}
            </>
          ),
        )}

        {section(
          'Análisis estructurado',
          !insight ? (
            <p className={styles.emptyHint}>
              {detail.status === 'COMPLETED'
                ? 'No hay resultado guardado.'
                : 'El resultado aparecerá aquí cuando termine el procesamiento.'}
            </p>
          ) : (
            <div className={styles.insightAccordion}>
              <p className={styles.insightSectionIntro}>
                Explora cada bloque para ver el detalle. El resumen ejecutivo está abierto por defecto; el resto se
                pliega para escanear más rápido.
              </p>
              <InsightPanel title="Resumen ejecutivo" defaultOpen badge="Clave">
                <p className={`${styles.insightBody} ${styles.insightProse}`}>
                  {insight.executiveSummary ?? '—'}
                </p>
              </InsightPanel>
              <InsightPanel title="Clasificación de la oportunidad">
                <p className={`${styles.opportunityTypeLine} ${styles.insightProse}`}>
                  {insight.opportunityType ?? '—'}
                </p>
              </InsightPanel>
              <InsightPanel title="Tecnologías y ecosistemas">
                <TechStackChips value={insight.detectedTechnologies} />
              </InsightPanel>
              <InsightPanel
                title="Áreas Avvale detectadas:"
                preview={<AvvaleAreaPreviewTags units={extractAvvaleUnitCodes(insight.avvaleAreas)} />}
              >
                <div className={styles.insightBlockContent}>
                  <AvvaleAreasContent value={insight.avvaleAreas} />
                </div>
              </InsightPanel>
              <InsightPanel title="Visión funcional">
                <p className={`${styles.insightBody} ${styles.insightProse}`}>
                  {insight.functionalVision ?? '—'}
                </p>
              </InsightPanel>
              <InsightPanel title="Visión técnica">
                <p className={`${styles.insightBody} ${styles.insightProse}`}>
                  {insight.technicalVision ?? '—'}
                </p>
              </InsightPanel>
              <InsightPanel title="Riesgos, gaps y dependencias">
                <RisksInsightContent text={insight.risksAndUnknowns} />
              </InsightPanel>
              <InsightPanel title="Preguntas y próximos pasos">
                <div className={styles.insightBlockContent}>
                  <RecommendedQuestionsTable
                    analysisId={detail.id}
                    value={insight.recommendedQuestions}
                    onUpdated={load}
                  />
                </div>
              </InsightPanel>
              <InsightPanel title="Confianza y límites">
                <p className={`${styles.insightBody} ${styles.insightProse}`}>{insight.confidenceNotes ?? '—'}</p>
              </InsightPanel>
            </div>
          ),
        )}

        {detail.status === 'COMPLETED' ? (
          <section className={`${styles.sectionCard} ${styles.chatSection}`} aria-label="Chat">
            <h2 className={styles.sectionHeading}>Conversación sobre esta oportunidad</h2>
            <div className={styles.sectionBody}>
              <div className={styles.chatShell}>
                <div className={styles.chatHeaderBar}>
                  <span className={styles.chatAvatar} aria-hidden>
                    AV
                  </span>
                  <div className={styles.chatHeaderText}>
                    <div className={styles.chatHeaderTitle}>Asistente de análisis</div>
                    <p className={styles.chatHeaderSubtitle}>
                      Usa el insight, las fuentes y este hilo. Los documentos nuevos requieren volver a procesar el
                      análisis.
                    </p>
                  </div>
                </div>
                <div
                  ref={chatScrollRef}
                  className={styles.chatMessages}
                  role="log"
                  aria-live="polite"
                  aria-relevant="additions"
                >
                  {detail.messages.length === 0 && !chatBusy ? (
                    <div className={styles.chatEmptyState}>
                      <p className={styles.chatEmptyTitle}>Sin mensajes aún</p>
                      <p className={styles.chatEmptyHint}>
                        Pregunta por riesgos, alcance técnico o mensajes sugeridos para el cliente.
                      </p>
                    </div>
                  ) : null}
                  {detail.messages.map((m) => {
                    const isUser = m.role === 'USER';
                    const timeLabel = formatMessageTime(m.createdAt);
                    return (
                      <div
                        key={m.id}
                        className={`${styles.bubbleRow} ${isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant}`}
                      >
                        <div
                          className={`${styles.bubble} ${
                            isUser ? styles.bubbleUser : styles.bubbleAssistant
                          }`}
                        >
                          <div className={styles.bubbleMeta}>
                            <span className={styles.bubbleLabel}>{isUser ? 'Tú' : 'Asistente'}</span>
                            {timeLabel ? (
                              <time className={styles.bubbleTime} dateTime={m.createdAt}>
                                {timeLabel}
                              </time>
                            ) : null}
                          </div>
                          <div className={styles.bubbleContent}>
                            {isUser ? (
                              <p className={styles.chatUserText}>{m.content}</p>
                            ) : (
                              <RfqAssistantMessageBody text={m.content} />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {chatBusy ? (
                    <div className={`${styles.bubbleRow} ${styles.bubbleRowAssistant}`} aria-busy="true">
                      <div className={`${styles.bubble} ${styles.bubbleAssistant} ${styles.bubbleTyping}`}>
                        <div className={styles.bubbleMeta}>
                          <span className={styles.bubbleLabel}>Asistente</span>
                        </div>
                        <div className={styles.typingDots} aria-label="El asistente está escribiendo">
                          <span className={styles.typingDot} />
                          <span className={styles.typingDot} />
                          <span className={styles.typingDot} />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
                <form
                  className={styles.chatForm}
                  onSubmit={(e) => void sendChat(e)}
                  aria-busy={chatBusy}
                >
                  <div className={styles.chatComposer}>
                    <div className={styles.chatInputWrap}>
                      <label htmlFor="rfq-chat-input" className={styles.visuallyHidden}>
                        Mensaje al asistente
                      </label>
                      <textarea
                        id="rfq-chat-input"
                        className={`${styles.chatInput} rfq-chat-input`}
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
                          e.preventDefault();
                          void sendChat();
                        }}
                        placeholder="Ej.: ¿Qué riesgos son prioritarios antes de la reunión con el cliente?"
                        disabled={chatBusy}
                        rows={1}
                        autoComplete="off"
                      />
                    </div>
                    <button
                      type="submit"
                      className={`${styles.primaryBtn} ${styles.chatSendBtn}`}
                      disabled={chatBusy || !chatInput.trim()}
                    >
                      {chatBusy ? (
                        <Fragment>
                          <span className={styles.chatSendSpinner} aria-hidden />
                          Enviando…
                        </Fragment>
                      ) : (
                        'Enviar'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </section>
        ) : null}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Eliminar análisis RFQ"
        message={`¿Eliminar «${detail.title}»? Se borrarán fuentes, resultado estructurado, conversación y adjuntos. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => void deleteAnalysis()}
        onCancel={() => {
          if (!deleteBusy) setDeleteOpen(false);
        }}
      />
    </main>
  );
}
