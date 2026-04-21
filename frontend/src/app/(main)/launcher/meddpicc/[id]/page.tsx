'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Script from 'next/script';
import { apiFetch, apiUpload } from '@/lib/api';
import { PageBreadcrumb, PageHero, PageBackLink, ChevronBackIcon } from '@/components/page-hero';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { useUser } from '@/contexts/UserContext';
import { MeddpiccDimensionIcon } from '@/lib/meddpicc-dimension-icon';
import {
  euroDigitsFromStored,
  euroDigitsToStored,
  formatEuroDigitsForDisplay,
  sanitizeEuroDigitsFromInput,
} from '@/lib/euro-deal-value';
import { MeddpiccContextDropzone } from '@/components/meddpicc/MeddpiccContextDropzone';
import { guideLineForScore, MeddpiccRadarChart } from '@/components/meddpicc/MeddpiccDimensionsScoreChart';
import chartStyles from '@/components/meddpicc/MeddpiccDimensionsScoreChart.module.css';
import {
  MEDDPICC_DIMENSIONS,
  MEDDPICC_SCORE_LABELS,
  type MeddpiccDimensionDef,
} from '@/lib/meddpicc-dimensions';
import {
  buildConvaiFirstMessageSpanish,
  buildMeddpiccConvaiDynamicPayload,
} from '@/lib/meddpicc-convai-context';
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
  createdAt?: string;
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

function formatDateDayEs(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('es', { day: 'numeric', month: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

function formatRelativeTimeEs(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const diffMs = Date.now() - d.getTime();
    const sec = Math.floor(diffMs / 1000);
    if (sec < 45) return 'hace un momento';
    const min = Math.floor(sec / 60);
    if (min < 60) return `hace ${min}m`;
    const h = Math.floor(min / 60);
    if (h < 48) return `hace ${h}h`;
    const days = Math.floor(h / 24);
    if (days < 14) return `hace ${days}d`;
    return formatDateDayEs(iso);
  } catch {
    return iso;
  }
}

function meddpiccAggregatePercent(scores: Record<string, number>): number {
  const keys = MEDDPICC_DIMENSIONS.map((d) => d.key);
  const sum = keys.reduce((s, k) => s + (Number(scores[k]) || 0), 0);
  return Math.round((sum / (keys.length * 10)) * 100);
}

function dealHealthFromPercent(pct: number): { label: string; tone: 'weak' | 'mid' | 'good' | 'great' } {
  if (pct < 35) return { label: 'Deal débil — alto riesgo', tone: 'weak' };
  if (pct < 50) return { label: 'Deal frágil — riesgo elevado', tone: 'weak' };
  if (pct < 65) return { label: 'Deal mejorable — riesgo medio', tone: 'mid' };
  if (pct < 80) return { label: 'Deal moderado', tone: 'good' };
  return { label: 'Deal sólido — bajo riesgo', tone: 'great' };
}

/** Leyenda corta para KPIs del dashboard (alineada con los umbrales de salud del deal). */
function meddpiccRiskCaption(pct: number): string {
  if (pct < 35) return 'Alto riesgo';
  if (pct < 50) return 'Riesgo elevado';
  if (pct < 65) return 'Riesgo medio';
  if (pct < 80) return 'Riesgo moderado';
  return 'Bajo riesgo';
}

/** Color de barra del dashboard: rojo / ámbar / verde según rango (no el color corporativo de la dimensión). */
function scoreDashboardBand(score: number): 'empty' | 'weak' | 'mid' | 'strong' {
  const s = Math.min(10, Math.max(0, Number(score) || 0));
  if (s <= 0) return 'empty';
  if (s <= 3) return 'weak';
  if (s <= 6) return 'mid';
  return 'strong';
}

function attentionStrengthLabel(score: number): string {
  const s = Math.min(10, Math.max(0, Number(score) || 0));
  if (s <= 3) return 'Débil';
  if (s <= 6) return 'Mejorable';
  return 'A vigilar';
}

const STRATEGY_DIM_EMOJI: Record<string, string> = {
  M: '📊',
  E: '💰',
  D1: '📋',
  D2: '🔄',
  P: '📝',
  I: '🔥',
  C1: '🏆',
  C2: '⚔️',
};

type StrategyBannerTone = 'critical' | 'warning' | 'caution' | 'positive';

type StrategyActionRow = {
  dimensionKey: string;
  name: string;
  emoji: string;
  score: number;
  advice: string;
};

function parseDealStatusBannerFromNotes(raw: unknown): {
  tone: StrategyBannerTone;
  title: string;
  body: string;
} | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const title = typeof o.title === 'string' ? o.title.trim() : '';
  const body = typeof o.body === 'string' ? o.body.trim() : '';
  const toneIn = o.tone;
  if (!title || !body) return null;
  const tone: StrategyBannerTone =
    toneIn === 'critical' || toneIn === 'warning' || toneIn === 'caution' || toneIn === 'positive'
      ? toneIn
      : 'warning';
  return { tone, title, body };
}

function defaultStrategyBanner(pct: number): { tone: StrategyBannerTone; title: string; body: string } {
  const h = dealHealthFromPercent(pct);
  const tone: StrategyBannerTone =
    h.tone === 'weak' ? 'critical' : h.tone === 'mid' ? 'warning' : h.tone === 'good' ? 'caution' : 'positive';
  const titles: Record<StrategyBannerTone, string> = {
    critical: '🚨 Deal en riesgo — acción urgente',
    warning: '⚠️ Deal frágil — prioriza cerrar gaps',
    caution: '📌 Deal mejorable — trabajo por delante',
    positive: '✅ Deal sólido — mantén el ritmo',
  };
  const bodies: Record<StrategyBannerTone, string> = {
    critical:
      'Este deal tiene riesgos serios. Decide si vale la pena invertir más tiempo o si es mejor redirigir esfuerzos.',
    warning:
      'Hay huecos importantes en la información. Prioriza validar lo crítico antes de profundizar en propuesta.',
    caution: 'El escenario es defendible, pero sin refuerzo en varias dimensiones el cierre puede alargarse.',
    positive: 'Buen encaje general. Sigue validando los últimos puntos antes de la firma.',
  };
  return { tone, title: titles[tone], body: bodies[tone] };
}

function parseStrategyActionRows(raw: unknown): StrategyActionRow[] {
  if (!Array.isArray(raw)) return [];
  const keys = new Set(MEDDPICC_DIMENSIONS.map((d) => d.key));
  const out: StrategyActionRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const o = row as Record<string, unknown>;
    const dimensionKey = typeof o.dimensionKey === 'string' ? o.dimensionKey.trim() : '';
    if (!keys.has(dimensionKey)) continue;
    const dim = MEDDPICC_DIMENSIONS.find((d) => d.key === dimensionKey);
    const name =
      typeof o.name === 'string' && o.name.trim() ? o.name.trim() : dim?.name ?? dimensionKey;
    const advice = typeof o.advice === 'string' ? o.advice.trim() : '';
    if (!advice) continue;
    const emoji =
      typeof o.emoji === 'string' && o.emoji.trim() ? o.emoji.trim() : STRATEGY_DIM_EMOJI[dimensionKey] ?? '📌';
    let score = 0;
    if (typeof o.score === 'number' && Number.isFinite(o.score)) score = o.score;
    else if (typeof o.score === 'string') score = Number(o.score);
    score = Math.min(10, Math.max(0, Math.round(Number.isFinite(score) ? score : 0)));
    out.push({ dimensionKey, name, emoji, score, advice });
  }
  return out;
}

function fallbackCriticalActions(scores: Record<string, number>): StrategyActionRow[] {
  return [...MEDDPICC_DIMENSIONS]
    .map((d) => ({ d, s: Math.min(10, Math.max(0, scores[d.key] ?? 0)) }))
    .filter(({ s }) => s > 0 && s <= 4)
    .sort((a, b) => a.s - b.s)
    .slice(0, 5)
    .map(({ d, s }) => ({
      dimensionKey: d.key,
      name: d.name,
      emoji: STRATEGY_DIM_EMOJI[d.key] ?? '📌',
      score: s,
      advice:
        'Esta dimensión está débil en la evaluación. Completa las respuestas guía y ejecuta «Analizar con IA» para obtener un plan de acción detallado.',
    }));
}

function fallbackAreasToReinforce(scores: Record<string, number>): StrategyActionRow[] {
  return [...MEDDPICC_DIMENSIONS]
    .map((d) => ({ d, s: Math.min(10, Math.max(0, scores[d.key] ?? 0)) }))
    .filter(({ s }) => s >= 5 && s <= 7)
    .sort((a, b) => a.s - b.s)
    .slice(0, 4)
    .map(({ d, s }) => ({
      dimensionKey: d.key,
      name: d.name,
      emoji: STRATEGY_DIM_EMOJI[d.key] ?? '📌',
      score: s,
      advice:
        'Refuerza esta dimensión antes del cierre: valida datos con el cliente y vuelve a ejecutar el análisis con IA.',
    }));
}

/** Texto de «Justificación IA» en el panel de dimensión: escala + cobertura de preguntas (datos ya usados en la evaluación). */
function dimensionAiJustificationText(
  dim: MeddpiccDimensionDef,
  score: number,
  answeredInDim: number,
  totalQsInDim: number,
): string {
  const guide = guideLineForScore(dim, score);
  const s = Math.min(10, Math.max(0, Math.round(score)));
  const scoreLabel = MEDDPICC_SCORE_LABELS[s] ?? '';
  const parts: string[] = [];
  parts.push(`Puntuación actual ${score}/10 (${scoreLabel}) en «${dim.name}».`);
  if (guide.trim()) {
    parts.push(`Según la escala MEDDPICC de esta dimensión, el nivel descriptivo aplicable es «${guide}».`);
  }
  if (totalQsInDim > 0) {
    parts.push(`Cobertura de preguntas guía: ${answeredInDim} de ${totalQsInDim}.`);
    if (answeredInDim < totalQsInDim) {
      parts.push('Completar las respuestas pendientes mejora la coherencia entre el contexto capturado y la nota del bloque.');
    } else {
      parts.push('Las preguntas guía de esta dimensión están completas.');
    }
  }
  return parts.join(' ');
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

/** Normaliza el snapshot guardado en notas tras el último análisis (mismas claves que la evaluación). */
function parseAnswersAtLastAnalysis(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const dim of MEDDPICC_DIMENSIONS) {
    for (const q of dim.questions) {
      const v = src[q.id];
      out[q.id] = v != null && typeof v !== 'object' ? String(v) : '';
    }
  }
  return out;
}

function answersDifferFromSnapshot(
  current: Record<string, string>,
  snapshot: Record<string, string> | null,
): boolean {
  if (!snapshot) return false;
  for (const dim of MEDDPICC_DIMENSIONS) {
    for (const q of dim.questions) {
      const a = (current[q.id] ?? '').trim();
      const b = (snapshot[q.id] ?? '').trim();
      if (a !== b) return true;
    }
  }
  return false;
}

function CollapsibleAiSection({
  sectionId,
  title,
  expanded,
  onToggle,
  children,
}: {
  sectionId: string;
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const headId = `ai-section-head-${sectionId}`;
  return (
    <div className={`${styles.aiBlock} ${expanded ? styles.aiBlockExpandOpen : ''}`}>
      <button
        type="button"
        className={styles.aiBlockToggle}
        id={headId}
        aria-expanded={expanded}
        aria-controls={`ai-section-panel-${sectionId}`}
        onClick={onToggle}
      >
        <h3 className={styles.aiBlockToggleTitle}>{title}</h3>
        <span className={styles.aiBlockChevron} aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M9 18l6-6-6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
      {expanded ? (
        <div id={`ai-section-panel-${sectionId}`} className={styles.aiBlockBody} role="region" aria-labelledby={headId}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export default function MeddpiccDealDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const router = useRouter();
  const me = useUser();
  const isAdmin = me?.role === 'ADMIN';

  const [tab, setTab] = useState<'eval' | 'dashboard' | 'ai'>('eval');
  /** Vista del bloque «Puntuación por dimensión» en Dashboard (mismo conmutador que el gráfico MEDDPICC). */
  const [dashboardDimView, setDashboardDimView] = useState<'bars' | 'radar'>('bars');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deal, setDeal] = useState<DealApi | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [valueEuroDigits, setValueEuroDigits] = useState('');
  const [context, setContext] = useState('');
  const [scores, setScores] = useState<Record<string, number>>(emptyScores);
  const [answers, setAnswers] = useState<Record<string, string>>(emptyAnswers);

  const [saveBusy, setSaveBusy] = useState(false);
  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  /** Huella de `answers` al pulsar «Cerrar» en el aviso inferior derecho; vuelve a mostrarse si cambian las respuestas. */
  const [staleDismissAnswersFingerprint, setStaleDismissAnswersFingerprint] = useState<string | null>(null);
  const [additionalCtx, setAdditionalCtx] = useState('');
  const [analyzeBusy, setAnalyzeBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState<AttachmentRow | null>(null);
  const [deleteAttachBusy, setDeleteAttachBusy] = useState(false);
  const [openDimKey, setOpenDimKey] = useState<string | null>('M');
  /** Solo un bloque de markdown visible a la vez (por id de adjunto). */
  const [openMdAttachmentId, setOpenMdAttachmentId] = useState<string | null>(null);
  /** Panel de dropzone + lista: compacto por defecto (solo título, texto y botón). */
  const [attachPanelOpen, setAttachPanelOpen] = useState(false);
  /** Respuesta MEDDPICC en modo lectura; al pulsar pasa a textarea hasta blur. */
  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null);
  /** Dimensión cuyo score (0–10) se edita con input; el resto muestra chip clicable. */
  const [editingDimScoreKey, setEditingDimScoreKey] = useState<string | null>(null);
  const answerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const dimScoreInputRef = useRef<HTMLInputElement | null>(null);
  const convaiWidgetRef = useRef<HTMLElement | null>(null);
  /** Huella JSON de `notes.convaiLastCall` para detectar nueva sesión tras el webhook. */
  const lastConvaiFingerprintRef = useRef<string>('null');
  const convaiPollAbortRef = useRef(false);
  /** Polling en segundo plano tras interactuar con el embed (el widget a veces no emite `conversationEnded`). */
  const convaiFpWatchRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const skipInitialAccordionScroll = useRef(true);
  /** Bloques .aiBlock plegados por defecto; se abren al pulsar la cabecera. */
  const [aiBlockOpen, setAiBlockOpen] = useState<Record<string, boolean>>({});
  const toggleAiBlock = useCallback((key: string) => {
    setAiBlockOpen((p) => ({ ...p, [key]: !p[key] }));
  }, []);

  useEffect(() => {
    const ids = new Set((deal?.attachments ?? []).map((x) => x.id));
    if (openMdAttachmentId && !ids.has(openMdAttachmentId)) {
      setOpenMdAttachmentId(null);
    }
  }, [deal?.attachments, openMdAttachmentId]);

  useEffect(() => {
    if (!openDimKey) return;
    if (skipInitialAccordionScroll.current) {
      skipInitialAccordionScroll.current = false;
      return;
    }
    const el = document.getElementById(`dim-section-${openDimKey}`);
    if (!el) return;
    const reduceMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    });
  }, [openDimKey]);

  useEffect(() => {
    setEditingAnswerId(null);
    setEditingDimScoreKey(null);
  }, [openDimKey]);

  useEffect(() => {
    if (!editingAnswerId) return;
    requestAnimationFrame(() => {
      answerTextareaRef.current?.focus();
    });
  }, [editingAnswerId]);

  useEffect(() => {
    if (!editingDimScoreKey) return;
    requestAnimationFrame(() => {
      dimScoreInputRef.current?.focus();
      dimScoreInputRef.current?.select();
    });
  }, [editingDimScoreKey]);

  const load = useCallback(async (): Promise<DealApi | null> => {
    if (!id) return null;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/meddpicc/deals/${id}`);
      if (!res.ok) {
        setError('No se pudo cargar el deal');
        return null;
      }
      const data = (await res.json()) as { deal: DealApi; history: HistoryRow[] };
      const d = data.deal;
      setDeal({ ...d, attachments: d.attachments ?? [] });
      setHistory(data.history ?? []);
      setName(d.name);
      setCompany(d.company);
      setValueEuroDigits(euroDigitsFromStored(d.value));
      setContext(d.context ?? '');
      const es = emptyScores();
      const mergedScores = { ...es, ...(typeof d.scores === 'object' && d.scores ? d.scores : {}) };
      setScores(mergedScores);
      const ea = emptyAnswers();
      const ans = typeof d.answers === 'object' && d.answers ? (d.answers as Record<string, string>) : {};
      setAnswers({ ...ea, ...ans });
      return d;
    } catch {
      setError('Error de red');
      return null;
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Persiste datos del formulario (incl. respuestas MEDDPICC) para que el backend use la última versión. */
  const persistDealEval = useCallback(async (): Promise<boolean> => {
    if (!id) return false;
    try {
      const res = await apiFetch(`/api/meddpicc/deals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          company: company.trim(),
          value: euroDigitsToStored(valueEuroDigits),
          context: context.trim() || null,
          scores,
          answers,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        const msg = Array.isArray(j.message) ? j.message.join(', ') : j.message;
        setError(msg || 'No se pudo guardar');
        return false;
      }
      const data = (await res.json()) as { deal: DealApi };
      setDeal(data.deal);
      setValueEuroDigits(euroDigitsFromStored(data.deal.value));
      return true;
    } catch {
      setError('Error de red');
      return false;
    }
  }, [id, name, company, valueEuroDigits, context, scores, answers]);

  const saveAll = async () => {
    if (!id) return;
    setSaveBusy(true);
    setError(null);
    try {
      await persistDealEval();
    } finally {
      setSaveBusy(false);
    }
  };

  const convaiDebugEnabled = true;
  const [convaiSimBusy, setConvaiSimBusy] = useState(false);
  const [convaiEndModalOpen, setConvaiEndModalOpen] = useState(false);
  const [convaiEndModalLoading, setConvaiEndModalLoading] = useState(false);
  const [convaiEndModalData, setConvaiEndModalData] = useState<Record<string, unknown> | null>(null);
  const [convaiSyncBusy, setConvaiSyncBusy] = useState(false);
  const [convaiClientPaste, setConvaiClientPaste] = useState('');
  const [convaiClientBusy, setConvaiClientBusy] = useState(false);

  const pollForNewConvaiAfterCall = useCallback(
    async (baselineFingerprint: string): Promise<Record<string, unknown> | null> => {
      if (!id) return null;
      convaiPollAbortRef.current = false;
      for (let attempt = 0; attempt < 36; attempt++) {
        if (convaiPollAbortRef.current) return null;
        await new Promise((r) => setTimeout(r, 1700));
        if (convaiPollAbortRef.current) return null;
        const res = await apiFetch(`/api/meddpicc/deals/${id}`);
        if (!res.ok) continue;
        const data = (await res.json()) as { deal: DealApi };
        const n = data.deal.notes;
        const raw = n && typeof n === 'object' && !Array.isArray(n) ? (n as Record<string, unknown>).convaiLastCall : null;
        const fp = JSON.stringify(raw ?? null);
        if (fp !== baselineFingerprint && fp !== 'null') {
          await load();
          return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
        }
      }
      return null;
    },
    [id, load],
  );

  const clearConvaiFpWatch = useCallback(() => {
    if (convaiFpWatchRef.current) {
      clearInterval(convaiFpWatchRef.current);
      convaiFpWatchRef.current = null;
    }
  }, []);

  /** Tras pulsar en el embed, vigila el deal hasta que el webhook actualice `convaiLastCall` (≈3 min). */
  const startConvaiFpWatchFromBaseline = useCallback(
    (baselineFingerprint: string) => {
      clearConvaiFpWatch();
      if (!id) return;
      let attempts = 0;
      const maxAttempts = 72;
      convaiFpWatchRef.current = setInterval(() => {
        attempts += 1;
        if (attempts > maxAttempts) {
          clearConvaiFpWatch();
          return;
        }
        void (async () => {
          const res = await apiFetch(`/api/meddpicc/deals/${id}`);
          if (!res.ok) return;
          const data = (await res.json()) as { deal: DealApi };
          const n = data.deal.notes;
          const raw =
            n && typeof n === 'object' && !Array.isArray(n)
              ? (n as Record<string, unknown>).convaiLastCall
              : null;
          const fp = JSON.stringify(raw ?? null);
          if (fp !== baselineFingerprint && fp !== 'null') {
            clearConvaiFpWatch();
            await load();
            const latest =
              raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
            if (latest) {
              setConvaiEndModalOpen(true);
              setConvaiEndModalLoading(false);
              setConvaiEndModalData(latest);
            }
          }
        })();
      }, 2500);
    },
    [id, load, clearConvaiFpWatch],
  );

  useEffect(() => () => clearConvaiFpWatch(), [clearConvaiFpWatch]);

  const handleConvaiConversationEnded = useCallback(async () => {
    clearConvaiFpWatch();
    const baseline = lastConvaiFingerprintRef.current;
    convaiPollAbortRef.current = false;
    setConvaiEndModalOpen(true);
    setConvaiEndModalLoading(true);
    setConvaiEndModalData(null);
    const found = await pollForNewConvaiAfterCall(baseline);
    setConvaiEndModalLoading(false);
    setConvaiEndModalData(found);
  }, [clearConvaiFpWatch, pollForNewConvaiAfterCall]);

  const closeConvaiEndModal = useCallback(() => {
    convaiPollAbortRef.current = true;
    clearConvaiFpWatch();
    setConvaiEndModalOpen(false);
    setConvaiEndModalLoading(false);
    setConvaiEndModalData(null);
  }, [clearConvaiFpWatch]);

  const syncConvaiTranscription = useCallback(async () => {
    if (!id) return;
    setConvaiSyncBusy(true);
    setError(null);
    try {
      const d = await load();
      if (!d) return;
      const raw =
        d.notes && typeof d.notes === 'object' && !Array.isArray(d.notes)
          ? (d.notes as Record<string, unknown>).convaiLastCall
          : null;
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        setConvaiEndModalOpen(true);
        setConvaiEndModalLoading(false);
        setConvaiEndModalData(raw as Record<string, unknown>);
      } else {
        setError(
          'Todavía no hay transcripción en el servidor. Espera unos segundos tras colgar, vuelve a pulsar o pega el texto en «Si el webhook falló».',
        );
      }
    } catch {
      setError('Error de red');
    } finally {
      setConvaiSyncBusy(false);
    }
  }, [id, load]);

  const submitClientConvaiTranscript = async () => {
    if (!id || !convaiClientPaste.trim()) return;
    setConvaiClientBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/meddpicc/deals/${id}/convai/client-transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcriptMarkdown: convaiClientPaste.trim() }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        const msg = Array.isArray(j.message) ? j.message.join(', ') : j.message;
        setError(msg || 'No se pudo guardar la transcripción');
        return;
      }
      setConvaiClientPaste('');
      await load();
    } catch {
      setError('Error de red');
    } finally {
      setConvaiClientBusy(false);
    }
  };

  const simulateConvaiWebhook = async () => {
    if (!id) return;
    setConvaiSimBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/meddpicc/deals/${id}/convai/simulate-post-call`, { method: 'POST' });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        const msg = Array.isArray(j.message) ? j.message.join(', ') : j.message;
        setError(msg || 'No se pudo simular el webhook');
        return;
      }
      await load();
    } catch {
      setError('Error de red');
    } finally {
      setConvaiSimBusy(false);
    }
  };

  const runAnalyze = async () => {
    if (!id) return;
    setAnalyzeBusy(true);
    setError(null);
    try {
      const saved = await persistDealEval();
      if (!saved) return;

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
      setAttachPanelOpen(true);
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
  const answersSnapshotAtLastAnalysis = useMemo(
    () => parseAnswersAtLastAnalysis(notes.answersAtLastAnalysis),
    [notes],
  );
  const staleAnalysis = useMemo(() => {
    if (!lastAnalysis) return false;
    if (!answersSnapshotAtLastAnalysis) return false;
    return answersDifferFromSnapshot(answers, answersSnapshotAtLastAnalysis);
  }, [lastAnalysis, answers, answersSnapshotAtLastAnalysis]);

  const answersFingerprint = useMemo(() => JSON.stringify(answers), [answers]);

  useEffect(() => {
    if (!staleAnalysis) setStaleDismissAnswersFingerprint(null);
  }, [staleAnalysis]);

  const showStaleCornerPanel = useMemo(() => {
    if (!staleAnalysis || analyzeOpen) return false;
    if (staleDismissAnswersFingerprint === null) return true;
    return staleDismissAnswersFingerprint !== answersFingerprint;
  }, [staleAnalysis, analyzeOpen, staleDismissAnswersFingerprint, answersFingerprint]);

  const convaiDynamicVariablesJson = useMemo(() => {
    if (!id) return '';
    const payload = buildMeddpiccConvaiDynamicPayload({
      dealId: id,
      dealName: name,
      company,
      valueEuroDigits,
      context,
      owner: deal?.owner,
      answers,
      notes,
    });
    return JSON.stringify(payload);
  }, [id, name, company, valueEuroDigits, context, deal?.owner, answers, notes]);

  useEffect(() => {
    const el = convaiWidgetRef.current;
    if (!el || !id) return;
    const onEnd = () => {
      void handleConvaiConversationEnded();
    };
    const names = ['conversationEnded', 'call-ended', 'convai-call-ended', 'session-ended'];
    for (const n of names) {
      el.addEventListener(n, onEnd as EventListener);
    }
    return () => {
      for (const n of names) {
        el.removeEventListener(n, onEnd as EventListener);
      }
    };
  }, [id, handleConvaiConversationEnded, convaiDynamicVariablesJson]);

  const convaiPendingCount = useMemo(() => {
    let n = 0;
    for (const dim of MEDDPICC_DIMENSIONS) {
      for (const q of dim.questions) {
        if (!(answers[q.id] ?? '').trim()) n++;
      }
    }
    return n;
  }, [answers]);

  const convaiFirstMessage = useMemo(
    () =>
      buildConvaiFirstMessageSpanish({
        clienteONombreDeal: company.trim() || name.trim(),
        pendingCount: convaiPendingCount,
      }),
    [company, name, convaiPendingCount],
  );

  const convaiLastCallFromWebhook = useMemo(() => {
    const raw = notes.convaiLastCall;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const o = raw as Record<string, unknown>;
    const summary = typeof o.summary === 'string' ? o.summary.trim() : '';
    const receivedAt = typeof o.receivedAt === 'string' ? o.receivedAt : '';
    const transcriptMarkdown = typeof o.transcriptMarkdown === 'string' ? o.transcriptMarkdown : '';
    const durationSecs = typeof o.durationSecs === 'number' && Number.isFinite(o.durationSecs) ? o.durationSecs : null;
    const conversationId = typeof o.conversationId === 'string' ? o.conversationId.trim() : '';
    if (!summary && !transcriptMarkdown && !receivedAt) return null;
    return { summary, receivedAt, transcriptMarkdown, durationSecs, conversationId };
  }, [notes]);

  const hasConvaiVoiceStored = Boolean(convaiLastCallFromWebhook);

  useEffect(() => {
    const raw =
      deal?.notes && typeof deal.notes === 'object' && !Array.isArray(deal.notes)
        ? (deal.notes as Record<string, unknown>).convaiLastCall
        : undefined;
    lastConvaiFingerprintRef.current = JSON.stringify(raw ?? null);
  }, [deal?.notes]);

  const staleCornerTitleId = useId();

  const scoreJustificationsByDim = useMemo((): Record<string, string> => {
    const raw = notes.scoreJustifications;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) out[k] = v.trim();
    }
    return out;
  }, [notes]);
  const analyzeActionLabel = lastAnalysis ? 'Re-analizar con IA' : 'Analizar con IA';

  const convaiEndModalDescription = useMemo(() => {
    if (convaiEndModalLoading) {
      return (
        <p className={styles.convaiEndModalStatus}>
          Recibiendo resumen y transcripción desde el servidor (webhook post-llamada)…
        </p>
      );
    }
    if (!convaiEndModalData) {
      return (
        <p className={styles.convaiEndModalStatus}>
          Aún no hay datos nuevos en el deal; el webhook puede tardar unos segundos. También puedes revisar la sección
          «Última llamada sincronizada» debajo del asistente de voz.
        </p>
      );
    }
    const summary =
      typeof convaiEndModalData.summary === 'string' ? convaiEndModalData.summary.trim() : '';
    const tr =
      typeof convaiEndModalData.transcriptMarkdown === 'string'
        ? convaiEndModalData.transcriptMarkdown
        : '';
    const dc = convaiEndModalData.dataCollectionResults;
    let dcBlock: ReactNode = null;
    if (dc != null && typeof dc === 'object' && !Array.isArray(dc)) {
      try {
        dcBlock = (
          <pre className={styles.convaiEndModalPreJson}>{JSON.stringify(dc, null, 2)}</pre>
        );
      } catch {
        dcBlock = null;
      }
    }
    return (
      <div className={styles.convaiEndModalBody}>
        {summary ? <p className={styles.convaiEndModalSummary}>{summary}</p> : null}
        {dcBlock ? (
          <>
            <p className={styles.convaiEndModalLabel}>Datos recogidos (data collection)</p>
            {dcBlock}
          </>
        ) : null}
        {tr ? (
          <details className={styles.convaiEndModalDetails} open>
            <summary>Transcripción</summary>
            <pre className={styles.convaiEndModalPre}>{tr}</pre>
          </details>
        ) : null}
      </div>
    );
  }, [convaiEndModalLoading, convaiEndModalData]);

  const ownerLine = useMemo(() => {
    if (!deal?.owner) return null;
    const o = deal.owner;
    const n = [o.name, o.lastName].filter(Boolean).join(' ');
    return `${o.email}${n ? ` · ${n}` : ''}`;
  }, [deal]);

  const aggregatePct = useMemo(() => meddpiccAggregatePercent(scores), [scores]);
  const dealHealth = useMemo(() => dealHealthFromPercent(aggregatePct), [aggregatePct]);

  const strategyDealBanner = useMemo(
    () => parseDealStatusBannerFromNotes(notes.dealStatusBanner) ?? defaultStrategyBanner(aggregatePct),
    [notes, aggregatePct],
  );

  const strategyCritical = useMemo(() => {
    const parsed = parseStrategyActionRows(notes.aiCriticalActions);
    if (parsed.length) return parsed;
    if (!lastAnalysis) return [];
    return fallbackCriticalActions(scores);
  }, [notes, scores, lastAnalysis]);

  const strategyAreas = useMemo(() => {
    const parsed = parseStrategyActionRows(notes.aiAreasToReinforce);
    if (parsed.length) return parsed;
    if (!lastAnalysis) return [];
    return fallbackAreasToReinforce(scores);
  }, [notes, scores, lastAnalysis]);

  const dashboardStats = useMemo(() => {
    const totalDims = MEDDPICC_DIMENSIONS.length;
    const scoredDims = MEDDPICC_DIMENSIONS.filter((d) => (scores[d.key] ?? 0) > 0).length;
    const allQuestionIds = MEDDPICC_DIMENSIONS.flatMap((d) => d.questions.map((q) => q.id));
    const totalQs = allQuestionIds.length;
    const answeredCount = allQuestionIds.filter((qid) => (answers[qid] ?? '').trim()).length;
    const sortedByScore = [...MEDDPICC_DIMENSIONS]
      .map((d, order) => ({ d, order, s: Math.min(10, Math.max(0, scores[d.key] ?? 0)) }))
      .sort((a, b) => (a.s !== b.s ? a.s - b.s : a.order - b.order))
      .map((x) => x.d);
    const attentionDims = sortedByScore.slice(0, 3);
    return { totalDims, scoredDims, totalQs, answeredCount, attentionDims };
  }, [scores, answers]);

  const goToDimensionEval = useCallback((dimKey: string) => {
    setTab('eval');
    setOpenDimKey(dimKey);
  }, []);

  /** Formulario «Datos generales» + adjuntos: oculto hasta pulsar lápiz en cabecera. */
  const [dealDetailEditorOpen, setDealDetailEditorOpen] = useState(false);

  const toggleDealDetailEditor = useCallback(() => {
    setDealDetailEditorOpen((open) => {
      const willOpen = !open;
      if (willOpen) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const section = document.getElementById('meddpicc-deal-detail');
            const reduceMotion =
              typeof window !== 'undefined' &&
              window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            section?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
            document.getElementById('ed-name')?.focus();
          });
        });
      }
      return willOpen;
    });
  }, []);

  const attachmentCount = deal?.attachments?.length ?? 0;
  const attachmentCountLabel =
    attachmentCount === 0
      ? '0 archivos'
      : attachmentCount === 1
        ? '1 archivo'
        : `${attachmentCount} archivos`;

  if (loading && !deal) {
    return (
      <div className={styles.page}>
        <PageBreadcrumb>
          <PageBackLink href="/launcher/meddpicc">
            <ChevronBackIcon />
            MEDDPICC
          </PageBackLink>
        </PageBreadcrumb>
        <div className={styles.loadingSkeleton} style={{ marginTop: 'var(--fiori-space-4)' }} aria-busy="true" aria-label="Cargando deal">
          <span className="sr-only">Cargando…</span>
          <div className={styles.skeletonCard}>
            <div className={styles.skeletonLine} style={{ width: '55%' }} />
            <div className={styles.skeletonLine} style={{ width: '100%' }} />
            <div className={styles.skeletonLine} style={{ width: '88%' }} />
            <div className={styles.skeletonLine} style={{ width: '40%' }} />
          </div>
        </div>
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
        <p className={styles.inlineError} style={{ marginTop: 'var(--fiori-space-4)' }}>
          {error}
        </p>
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
          <div className={styles.dealHeroSubtitle}>
            <span className={styles.dealHeroSubtitleLead}>{company.trim() || 'Sin empresa'}</span>
            <span className={styles.dealHeroSep} aria-hidden>
              ·
            </span>
            <span className={styles.dealHeroValueRow}>
              <svg
                className={styles.dealHeroValueIcon}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden
              >
                <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <ellipse cx="12" cy="12" rx="3" ry="2.25" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <span className={styles.dealHeroValueText}>
                {formatEuroDigitsForDisplay(valueEuroDigits).trim() || '0 €'}
              </span>
            </span>
            {ownerLine && isAdmin ? (
              <span className={styles.dealHeroOwnerFull}>
                Propietario: <strong>{ownerLine}</strong>
              </span>
            ) : null}
          </div>
        }
        meta={
          deal?.updatedAt ? (
            <>
              {deal.createdAt ? (
                <>
                  Creado: {formatDateDayEs(deal.createdAt)}
                  {' · '}
                </>
              ) : null}
              Actualizado {formatRelativeTimeEs(deal.updatedAt)}
            </>
          ) : null
        }
        actions={
          <div className={styles.dealHeroActions}>
            <div className={styles.dealHeroScore}>
              <span
                className={`${styles.dealHeroPct} ${
                  dealHealth.tone === 'weak'
                    ? styles.dealHeroPctWeak
                    : dealHealth.tone === 'mid'
                      ? styles.dealHeroPctMid
                      : dealHealth.tone === 'good'
                        ? styles.dealHeroPctGood
                        : styles.dealHeroPctGreat
                }`}
              >
                {aggregatePct}%
              </span>
              <span className={styles.dealHeroScoreCaption}>{dealHealth.label}</span>
              <span className={styles.dealHeroScoreHint}>Media MEDDPICC (0–10 por dimensión)</span>
            </div>
            <button
              type="button"
              className={`${styles.dealHeroEditBtn} ${dealDetailEditorOpen ? styles.dealHeroEditBtnActive : ''}`}
              onClick={() => toggleDealDetailEditor()}
              aria-expanded={dealDetailEditorOpen}
              aria-controls="meddpicc-deal-detail-panel"
              aria-label={dealDetailEditorOpen ? 'Ocultar datos del deal' : 'Mostrar y editar datos del deal'}
              title={dealDetailEditorOpen ? 'Ocultar datos del deal' : 'Mostrar y editar datos del deal'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 20h9M4 13l8-8 3 3-8 8H4v-3Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        }
        actionsClassName={styles.dealHeroPageActions}
      />

      <div className={styles.detailMain}>
      {error && <p className={styles.inlineError}>{error}</p>}

      <section className={styles.convaiSection} aria-labelledby="meddpicc-convai-heading">
        <h2 id="meddpicc-convai-heading" className={styles.sectionHeading}>
          Asistente de voz (MEDDPICC)
        </h2>
        <p className={styles.convaiHint}>
          La app envía a ElevenLabs el cliente, importe, propietario (nombre), contexto y las respuestas ya rellenadas;
          el foco debe ser solo lo pendiente. El UUID del deal va también en <code className={styles.convaiCode}>user-id</code>{' '}
          del widget (como <code className={styles.convaiCode}>user_id</code> en el webhook) para que la transcripción se
          guarde aunque el JSON de variables dinámicas sea muy grande. En el agente, usa en el prompt las variables (p. ej.{' '}
          <code className={styles.convaiCode}>{'{{cliente}}'}</code>, <code className={styles.convaiCode}>{'{{importe_deal}}'}</code>,{' '}
          <code className={styles.convaiCode}>{'{{meddpicc_pendiente}}'}</code>
          …) listadas en <code className={styles.convaiCode}>meddpicc-convai-context.ts</code>. Tras cada llamada, el
          webhook <code className={styles.convaiCode}>POST /webhooks/elevenlabs/meddpicc</code> (secreto en backend) puede
          guardar aquí el resumen y la transcripción.
        </p>
        <div
          className={styles.convaiEmbed}
          onPointerDownCapture={() => {
            const baseline = lastConvaiFingerprintRef.current;
            startConvaiFpWatchFromBaseline(baseline);
          }}
        >
          {convaiDynamicVariablesJson ? (
            <>
              <elevenlabs-convai
                ref={convaiWidgetRef}
                key={convaiDynamicVariablesJson}
                agent-id="agent_6301kpq853thfbnrmnzy95tv1qqj"
                user-id={id}
                dynamic-variables={convaiDynamicVariablesJson}
                override-language="es"
                override-first-message={convaiFirstMessage}
              />
              <Script src="https://unpkg.com/@elevenlabs/convai-widget-embed" strategy="lazyOnload" />
            </>
          ) : null}
        </div>
        <div className={styles.convaiToolbar}>
          <button
            type="button"
            className={styles.convaiToolbarBtn}
            disabled={convaiSyncBusy || !id}
            onClick={() => void syncConvaiTranscription()}
          >
            {convaiSyncBusy ? 'Sincronizando…' : 'Sincronizar transcripción'}
          </button>
          <p className={styles.convaiToolbarHint}>
            Tras colgar, la transcripción llega por webhook; si no ves nada, pulsa sincronizar o espera (también vigilamos
            el servidor unos minutos al usar el widget).
          </p>
        </div>
        <details className={styles.convaiClientFallback}>
          <summary>Si el webhook falló: pegar transcripción</summary>
          <p className={styles.convaiClientFallbackHint}>
            Solo si ElevenLabs no pudo notificar al servidor. El texto se guarda en el deal como última sesión de voz.
          </p>
          <textarea
            className={styles.convaiClientFallbackTextarea}
            rows={5}
            value={convaiClientPaste}
            onChange={(e) => setConvaiClientPaste(e.target.value)}
            placeholder="Pega aquí la transcripción…"
            disabled={convaiClientBusy}
          />
          <button
            type="button"
            className={styles.convaiClientFallbackBtn}
            disabled={convaiClientBusy || !convaiClientPaste.trim() || !id}
            onClick={() => void submitClientConvaiTranscript()}
          >
            {convaiClientBusy ? 'Guardando…' : 'Guardar en el deal'}
          </button>
        </details>
        {convaiLastCallFromWebhook ? (
          <div className={styles.convaiWebhookNote}>
            <h3 className={styles.convaiWebhookHeading}>Última llamada sincronizada</h3>
            <p className={styles.convaiWebhookUseHint}>
              Este contenido queda en el deal. Al pulsar «Analizar con IA» o «Re-analizar con IA», el modelo lo recibe como
              evidencia adicional junto con tus respuestas y el contexto.
            </p>
            <p className={styles.convaiWebhookMeta}>
              {convaiLastCallFromWebhook.receivedAt
                ? new Date(convaiLastCallFromWebhook.receivedAt).toLocaleString('es-ES', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })
                : '—'}
              {convaiLastCallFromWebhook.durationSecs != null
                ? ` · ${convaiLastCallFromWebhook.durationSecs}s`
                : ''}
              {convaiLastCallFromWebhook.conversationId
                ? ` · id ${convaiLastCallFromWebhook.conversationId.slice(0, 12)}…`
                : ''}
            </p>
            {convaiLastCallFromWebhook.summary ? (
              <p className={styles.convaiWebhookSummary}>{convaiLastCallFromWebhook.summary}</p>
            ) : null}
            {convaiLastCallFromWebhook.transcriptMarkdown ? (
              <details className={styles.convaiWebhookDetails}>
                <summary>Transcripción</summary>
                <pre className={styles.convaiWebhookTranscript}>{convaiLastCallFromWebhook.transcriptMarkdown}</pre>
              </details>
            ) : null}
          </div>
        ) : null}
      </section>

      <section id="meddpicc-deal-detail" aria-label="Datos generales del deal">
      <h2 className={styles.sectionHeading}>Datos generales</h2>
      {!dealDetailEditorOpen ? (
        <p className={styles.dealDetailCollapsedHint}>
          Los datos editables (nombre, empresa, valor, contexto y adjuntos) están ocultos. Pulsa el icono de lápiz en la cabecera
          para mostrarlos u ocultarlos.
        </p>
      ) : null}
      <div
        id="meddpicc-deal-detail-panel"
        className={styles.detailHeader}
        hidden={!dealDetailEditorOpen}
      >
        <div className={styles.formGridThree}>
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
            <label className={styles.fieldLabel} htmlFor="ed-val">
              Valor (€)
            </label>
            <input
              id="ed-val"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className={`${styles.input} ${styles.inputEuro}`}
              value={formatEuroDigitsForDisplay(valueEuroDigits)}
              onChange={(e) => setValueEuroDigits(sanitizeEuroDigitsFromInput(e.target.value))}
              placeholder="0 €"
            />
          </div>
          <div className={styles.formGridRowFull}>
            <label className={styles.fieldLabel} htmlFor="ed-ctx">
              Contexto del deal
            </label>
            <textarea id="ed-ctx" className={styles.textarea} rows={6} value={context} onChange={(e) => setContext(e.target.value)} />
          </div>
        </div>

        <div className={styles.attachSection}>
          <div className={styles.attachSectionHead}>
            <div className={styles.attachSectionTitleRow}>
              <h3 id="meddpicc-attach-heading" className={styles.attachSectionTitle}>
                Adjuntos para el contexto
              </h3>
              <span
                className={styles.attachCountBadge}
                aria-live="polite"
                title="Archivos incluidos en el contexto del análisis"
              >
                {attachmentCountLabel}
              </span>
            </div>
            <p className={styles.attachSectionDesc}>
              El contenido extraído se combina con el contexto libre y se usa en el análisis IA: arrastra archivos o elígelos desde el equipo.
            </p>
          </div>
          <div className={styles.attachSectionActions}>
            <button
              type="button"
              className={styles.primaryBtn}
              aria-expanded={attachPanelOpen}
              aria-controls="meddpicc-attach-panel"
              onClick={() => setAttachPanelOpen((o) => !o)}
            >
              {attachPanelOpen
                ? 'Ocultar'
                : (deal?.attachments?.length ?? 0) > 0
                  ? 'Editar adjuntos'
                  : 'Añadir'}
            </button>
          </div>
          {attachPanelOpen ? (
            <div
              id="meddpicc-attach-panel"
              className={styles.attachExpandPanel}
              role="region"
              aria-labelledby="meddpicc-attach-heading"
            >
              <MeddpiccContextDropzone uploading={uploadBusy} onFilesSelected={(list) => void uploadAttachments(list)} />
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
                      <button
                        type="button"
                        className={styles.mdPreviewToggle}
                        id={`md-toggle-${a.id}`}
                        aria-expanded={openMdAttachmentId === a.id}
                        aria-controls={`md-preview-${a.id}`}
                        disabled={uploadBusy || deleteAttachBusy}
                        onClick={() =>
                          setOpenMdAttachmentId((prev) => (prev === a.id ? null : a.id))
                        }
                      >
                        {openMdAttachmentId === a.id ? 'Ocultar markdown' : 'Ver markdown'}
                      </button>
                      {openMdAttachmentId === a.id && (
                        <pre
                          id={`md-preview-${a.id}`}
                          className={styles.mdPreview}
                          role="region"
                          aria-labelledby={`md-toggle-${a.id}`}
                        >
                          {a.extractedMarkdown}
                        </pre>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </div>
      </section>

      <div className={styles.aiBar}>
        <div>
          <span className={styles.aiBarTitle}>Análisis con IA</span>
          {lastAnalysis ? (
            <p className={styles.aiBarBody}>Último análisis: {formatDate(lastAnalysis)}</p>
          ) : (
            <p className={styles.aiBarBody}>Se usa la clave Anthropic guardada en tu perfil.</p>
          )}
          {hasConvaiVoiceStored ? (
            <p className={styles.aiBarBody}>
              Hay una sesión de voz guardada (resumen y transcripción). Se tendrá en cuenta automáticamente al ejecutar{' '}
              <strong>Analizar / Re-analizar con IA</strong>.
            </p>
          ) : null}
        </div>
        <div className={styles.aiBarActions}>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => setAnalyzeOpen(true)}
            aria-label={analyzeActionLabel}
          >
            <span>{analyzeActionLabel}</span>
            <img
              src="/img/Claude_AI_symbol.svg"
              alt=""
              width={18}
              height={18}
              className={styles.primaryBtnClaudeIcon}
              aria-hidden
            />
          </button>
          {convaiDebugEnabled ? (
            <button
              type="button"
              className={styles.aiBarSecondaryBtn}
              onClick={() => void simulateConvaiWebhook()}
              disabled={convaiSimBusy || !id}
              aria-label="Simular webhook (debug)"
              title="Inserta una llamada simulada en notes.convaiLastCall"
            >
              {convaiSimBusy ? 'Simulando…' : 'Simular webhook (debug)'}
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.tabs}>
        <button type="button" className={`${styles.tab} ${tab === 'eval' ? styles.tabActive : ''}`} onClick={() => setTab('eval')}>
          Evaluación
        </button>
        <button type="button" className={`${styles.tab} ${tab === 'dashboard' ? styles.tabActive : ''}`} onClick={() => setTab('dashboard')}>
          Dashboard
        </button>
        <button type="button" className={`${styles.tab} ${tab === 'ai' ? styles.tabActive : ''}`} onClick={() => setTab('ai')}>
          <span className={styles.tabLabelWithIcon}>
            Estrategia
            <img src="/img/Claude_AI_symbol.svg" alt="" width={16} height={16} className={styles.tabClaudeIcon} aria-hidden />
          </span>
        </button>
      </div>

      {tab === 'eval' && (
        <>
          <h2 className={`${styles.sectionHeading} ${styles.sectionHeadingTab}`}>Evaluación MEDDPICC</h2>
          {MEDDPICC_DIMENSIONS.map((dim) => {
            const isOpen = openDimKey === dim.key;
            const dimScore = Math.min(10, Math.max(0, scores[dim.key] ?? 0));
            return (
              <section
                key={dim.key}
                id={`dim-section-${dim.key}`}
                className={`${styles.dimCard} ${styles.dimCardAccordion} ${isOpen ? styles.dimCardOpen : ''}`}
                style={{ borderLeft: `4px solid ${dim.color}` }}
              >
                <div className={styles.dimCardHeaderRow}>
                  <button
                    type="button"
                    className={styles.dimCardTitleBtn}
                    id={`dim-trigger-${dim.key}`}
                    aria-expanded={isOpen}
                    aria-controls={`dim-panel-${dim.key}`}
                    onClick={() => setOpenDimKey((prev) => (prev === dim.key ? null : dim.key))}
                  >
                    <span className={styles.dimCardTitleIcon} style={{ color: dim.color }} aria-hidden>
                      <MeddpiccDimensionIcon dimensionKey={dim.key} size={20} />
                    </span>
                    <span className={styles.dimCardTitleText}>{dim.name}</span>
                    <span className={styles.dimChevron} aria-hidden>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                          d="M9 18l6-6-6-6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </button>
                  <div className={styles.dimCardScoreWrap}>
                    <span className={styles.dimScoreWrapLabel}>Puntuación</span>
                    {editingDimScoreKey === dim.key ? (
                      <input
                        ref={dimScoreInputRef}
                        id={`sc-${dim.key}`}
                        type="number"
                        min={0}
                        max={10}
                        inputMode="numeric"
                        autoComplete="off"
                        className={`${styles.input} ${styles.dimScoreInput}`}
                        aria-label={`Puntuación manual ${dim.name}, de 0 a 10`}
                        value={scores[dim.key] ?? 0}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const v =
                            raw === '' ? 0 : Math.min(10, Math.max(0, parseInt(raw, 10) || 0));
                          setScores((s) => ({ ...s, [dim.key]: v }));
                        }}
                        onBlur={() => setEditingDimScoreKey(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            setEditingDimScoreKey(null);
                          }
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className={styles.dimScoreChip}
                        style={{ borderLeftColor: dim.color }}
                        aria-label={`Puntuación ${dim.name}: ${dimScore} de 10. Pulsa para editar manualmente`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingDimScoreKey(dim.key);
                        }}
                      >
                        <span className={styles.dimScoreChipValue}>{dimScore}</span>
                        <span className={styles.dimScoreChipSuffix} aria-hidden>
                          /10
                        </span>
                      </button>
                    )}
                  </div>
                </div>
                <div className={styles.dimCardHeaderSub}>
                  <p className={styles.scoreHint}>{dim.description}</p>
                  <div className={styles.dimScoreProgress}>
                    <div
                      className={styles.dimScoreProgressTrack}
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={10}
                      aria-valuenow={dimScore}
                      aria-label={`Puntuación ${dim.name}: ${dimScore} de 10`}
                    >
                      <div
                        className={styles.dimScoreProgressFill}
                        style={{ width: `${dimScore * 10}%`, backgroundColor: dim.color }}
                      />
                    </div>
                    <span className={styles.dimScoreProgressValue} aria-hidden>
                      {dimScore}/10
                    </span>
                  </div>
                </div>
                {isOpen && (
                  <div
                    id={`dim-panel-${dim.key}`}
                    role="region"
                    aria-labelledby={`dim-trigger-${dim.key}`}
                    className={styles.dimCardPanel}
                  >
                    {dim.questions.map((q) => {
                      const answered = Boolean((answers[q.id] ?? '').trim());
                      const isEditing = editingAnswerId === q.id;
                      return (
                        <div
                          key={q.id}
                          className={`${styles.questionBlock} ${answered ? styles.questionBlockAnswered : styles.questionBlockPending}`}
                          aria-label={answered ? 'Pregunta respondida' : 'Pregunta pendiente'}
                        >
                          <div className={styles.questionBlockIcon} aria-hidden>
                            {answered ? (
                              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path
                                  d="M20 6L9 17l-5-5"
                                  stroke="currentColor"
                                  strokeWidth="2.2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            ) : (
                              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
                              </svg>
                            )}
                          </div>
                          <div className={styles.questionBlockBody}>
                            <p className={styles.questionLabel}>{q.q}</p>
                            <p className={styles.questionHint}>{q.hint}</p>
                            {isEditing ? (
                              <textarea
                                ref={answerTextareaRef}
                                id={`answer-${q.id}`}
                                className={styles.textarea}
                                rows={5}
                                aria-label="Respuesta"
                                value={answers[q.id] ?? ''}
                                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                                onBlur={() => setEditingAnswerId(null)}
                              />
                            ) : (
                              <button
                                type="button"
                                className={`${styles.questionAnswerDisplayBtn} ${answered ? styles.questionAnswerDisplayFilled : styles.questionAnswerDisplayEmpty}`}
                                aria-label={answered ? 'Editar respuesta' : 'Escribir respuesta'}
                                onClick={() => setEditingAnswerId(q.id)}
                              >
                                {answered ? (
                                  <span className={styles.questionAnswerText}>{answers[q.id]}</span>
                                ) : (
                                  <span className={styles.questionAnswerPlaceholder}>
                                    Pulsa para escribir tu respuesta…
                                  </span>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {(() => {
                      const totalQsInDim = dim.questions.length;
                      const answeredInDim = dim.questions.filter((q) => (answers[q.id] ?? '').trim()).length;
                      const fromAnalysis = scoreJustificationsByDim[dim.key] ?? '';
                      const aiJustify =
                        fromAnalysis ||
                        dimensionAiJustificationText(dim, dimScore, answeredInDim, totalQsInDim);
                      return (
                        <div
                          className={styles.dimAiJustify}
                          role="region"
                          aria-labelledby={`dim-ai-justify-${dim.key}`}
                        >
                          <div className={styles.dimAiJustifyHead}>
                            <img
                              src="/img/Claude_AI_symbol.svg"
                              alt=""
                              width={20}
                              height={20}
                              className={styles.dimAiJustifyIcon}
                              aria-hidden
                            />
                            <h4 id={`dim-ai-justify-${dim.key}`} className={styles.dimAiJustifyTitle}>
                              Justificación IA
                            </h4>
                          </div>
                          <p className={styles.dimAiJustifyBody}>{aiJustify}</p>
                          {!fromAnalysis && (
                            <p className={styles.dimAiJustifyHint}>
                              Para un comentario cualitativo sobre tus respuestas (fortalezas, vacíos y próximos pasos),
                              ejecuta «{analyzeActionLabel}» en la barra superior del deal.
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </section>
            );
          })}

          <div className={styles.toolbar}>
            <button type="button" className={styles.primaryBtn} disabled={saveBusy} onClick={() => void saveAll()}>
              {saveBusy ? 'Guardando…' : 'Guardar cambios'}
            </button>
            <button type="button" className={`${styles.ghostBtn} ${styles.dangerBtn}`} onClick={() => setDeleteOpen(true)}>
              Eliminar deal
            </button>
          </div>

          {history.length > 0 && (
            <CollapsibleAiSection
              sectionId="history"
              title="Historial de puntuaciones"
              expanded={Boolean(aiBlockOpen.history)}
              onToggle={() => toggleAiBlock('history')}
            >
              <ul className={styles.historyList}>
                {history.map((h) => (
                  <li key={h.id} className={styles.historyItem}>
                    {formatDate(h.createdAt)} — <strong>{h.dimension}</strong>
                    {h.score != null ? `: ${h.score}/10` : ''}
                    {h.note ? ` · ${h.note}` : ''}
                  </li>
                ))}
              </ul>
            </CollapsibleAiSection>
          )}
        </>
      )}

      {tab === 'dashboard' && (
        <>
          <h2 className={`${styles.sectionHeading} ${styles.sectionHeadingTab}`}>Dashboard</h2>
          <div className={styles.dashboardKpiGrid}>
            <div className={styles.dashboardKpiCard}>
              <div
                className={`${styles.dealHeroPct} ${
                  dealHealth.tone === 'weak'
                    ? styles.dealHeroPctWeak
                    : dealHealth.tone === 'mid'
                      ? styles.dealHeroPctMid
                      : dealHealth.tone === 'good'
                        ? styles.dealHeroPctGood
                        : styles.dealHeroPctGreat
                }`}
              >
                {aggregatePct}%
              </div>
              <div className={styles.dashboardKpiLabel}>Score total</div>
              <div className={styles.dashboardKpiSub}>{meddpiccRiskCaption(aggregatePct)}</div>
            </div>
            <div className={styles.dashboardKpiCard}>
              <div className={`${styles.dealHeroPct} ${styles.dashboardKpiMetricBlue}`}>
                {dashboardStats.scoredDims}/{dashboardStats.totalDims}
              </div>
              <div className={styles.dashboardKpiLabel}>Dimensiones puntuadas</div>
            </div>
            <div className={styles.dashboardKpiCard}>
              <div className={`${styles.dealHeroPct} ${styles.dashboardKpiMetricPurple}`}>
                {dashboardStats.answeredCount}/{dashboardStats.totalQs}
              </div>
              <div className={styles.dashboardKpiLabel}>Preguntas respondidas</div>
            </div>
            <div className={styles.dashboardKpiCard}>
              <div className={`${styles.dealHeroPct} ${styles.dashboardKpiMetricEuro}`}>
                {formatEuroDigitsForDisplay(valueEuroDigits).trim() || '0 €'}
              </div>
              <div className={styles.dashboardKpiLabel}>Valor (EUR)</div>
            </div>
          </div>

          <section className={styles.dashboardPanel} aria-labelledby="dash-dim-heading">
            <div className={styles.dashboardDimPanelHead}>
              <h3 id="dash-dim-heading" className={styles.dashboardPanelTitle}>
                Puntuación por dimensión
              </h3>
              <div className={chartStyles.viewToggle} role="group" aria-label="Tipo de visualización">
                <button
                  type="button"
                  className={
                    dashboardDimView === 'bars'
                      ? `${chartStyles.viewBtn} ${chartStyles.viewBtnActive}`
                      : chartStyles.viewBtn
                  }
                  onClick={() => setDashboardDimView('bars')}
                  aria-pressed={dashboardDimView === 'bars'}
                >
                  Barras
                </button>
                <button
                  type="button"
                  className={
                    dashboardDimView === 'radar'
                      ? `${chartStyles.viewBtn} ${chartStyles.viewBtnActive}`
                      : chartStyles.viewBtn
                  }
                  onClick={() => setDashboardDimView('radar')}
                  aria-pressed={dashboardDimView === 'radar'}
                  title="Mapa de posicionamiento tipo radar (octágono MEDDPICC)"
                >
                  Mapa radial
                </button>
              </div>
            </div>
            {dashboardDimView === 'bars' ? (
              <ul className={styles.dashboardDimList}>
                {MEDDPICC_DIMENSIONS.map((dim) => {
                  const dimScore = Math.min(10, Math.max(0, scores[dim.key] ?? 0));
                  const band = scoreDashboardBand(dimScore);
                  const guide = guideLineForScore(dim, dimScore);
                  const tipId = `score-tip-${dim.key}`;
                  const fillClass =
                    band === 'empty'
                      ? styles.dashboardBarFillEmpty
                      : band === 'weak'
                        ? styles.dashboardBarFillWeak
                        : band === 'mid'
                          ? styles.dashboardBarFillMid
                          : styles.dashboardBarFillStrong;
                  return (
                    <li key={dim.key} className={styles.dashboardDimRow}>
                      <div className={chartStyles.tooltipHost}>
                        <button
                          type="button"
                          className={styles.dashboardDimRowBtn}
                          onClick={() => goToDimensionEval(dim.key)}
                          aria-describedby={tipId}
                          aria-label={`${dim.name}: ${dimScore} de 10. Abrir en Evaluación`}
                        >
                          <span className={styles.dashboardDimRowLead}>
                            <span className={styles.dashboardDimRowIcon} style={{ color: dim.color }} aria-hidden>
                              <MeddpiccDimensionIcon dimensionKey={dim.key} size={20} />
                            </span>
                            <span className={styles.dashboardDimRowCode}>{dim.key}</span>
                          </span>
                          <span className={styles.dashboardDimRowName}>{dim.name}</span>
                          <span className={styles.dashboardDimRowBarWrap}>
                            <span className={styles.dashboardBarTrack}>
                              <span
                                className={`${styles.dashboardBarFill} ${fillClass}`}
                                style={{ width: `${dimScore * 10}%` }}
                              />
                            </span>
                          </span>
                          <span className={styles.dashboardDimRowScore}>{dimScore}/10</span>
                        </button>
                        <div id={tipId} className={chartStyles.tooltip} role="tooltip">
                          <p className={chartStyles.tooltipName} style={{ color: dim.color }}>
                            {dim.name}
                          </p>
                          <p className={chartStyles.tooltipScore}>
                            Score actual: <strong>{dimScore}/10</strong>
                          </p>
                          <p className={chartStyles.tooltipDesc}>{dim.description}</p>
                          {guide ? (
                            <p className={chartStyles.tooltipGuide}>
                              <strong>Escala de la dimensión</strong>: {guide}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <MeddpiccRadarChart scores={scores} />
            )}
          </section>

          <section className={styles.dashboardPanel} aria-labelledby="dash-att-heading">
            <h3 id="dash-att-heading" className={styles.dashboardPanelTitle}>
              Áreas de atención
            </h3>
            <ul className={styles.dashboardAttentionList}>
              {dashboardStats.attentionDims.map((dim) => {
                const dimScore = Math.min(10, Math.max(0, scores[dim.key] ?? 0));
                const qual = attentionStrengthLabel(dimScore);
                const qualClass =
                  dimScore <= 3
                    ? styles.dashboardAttentionQualWeak
                    : dimScore <= 6
                      ? styles.dashboardAttentionQualMid
                      : styles.dashboardAttentionQualLow;
                return (
                  <li key={dim.key}>
                    <button
                      type="button"
                      className={styles.dashboardAttentionRow}
                      onClick={() => goToDimensionEval(dim.key)}
                      aria-label={`${dim.name}: ${dimScore} de 10 (${qual}). Abrir en Evaluación`}
                    >
                      <span className={styles.dashboardAttentionIcon} style={{ color: dim.color }} aria-hidden>
                        <MeddpiccDimensionIcon dimensionKey={dim.key} size={20} />
                      </span>
                      <span className={styles.dashboardAttentionName}>{dim.name}</span>
                      <span className={styles.dashboardAttentionMeta}>
                        <strong>{dimScore}/10</strong>
                        <span className={qualClass}> — {qual}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      {tab === 'ai' && (
        <>
          <h2 className={`${styles.sectionHeading} ${styles.sectionHeadingTab}`}>Estrategia</h2>
          <div className={styles.strategyStack}>
            <div
              className={`${styles.strategyBanner} ${
                strategyDealBanner.tone === 'critical'
                  ? styles.strategyBannerCritical
                  : strategyDealBanner.tone === 'warning'
                    ? styles.strategyBannerWarning
                    : strategyDealBanner.tone === 'caution'
                      ? styles.strategyBannerCaution
                      : styles.strategyBannerPositive
              }`}
              role="region"
              aria-label="Estado del deal"
            >
              <h3 className={styles.strategyBannerTitle}>{strategyDealBanner.title}</h3>
              <p className={styles.strategyBannerBody}>{strategyDealBanner.body}</p>
            </div>

            {lastAnalysis && (aiAssessment.trim() || aiRisks.length > 0 || aiStrengths.length > 0) ? (
              <div className={styles.strategyCardIndigo}>
                <h3 className={styles.strategyValoracionTitle}>🤖 Valoración IA</h3>
                {aiAssessment.trim() ? (
                  <p className={styles.strategyValoracionLead}>{aiAssessment}</p>
                ) : null}
                {aiRisks.length > 0 ? (
                  <div className={styles.strategyValoracionBlock}>
                    <h4 className={styles.strategyRisksHeading}>Riesgos identificados</h4>
                    <ul className={styles.strategyRiskList}>
                      {aiRisks.map((x, i) => (
                        <li key={i} className={styles.strategyRiskItem}>
                          <span className={styles.strategyRiskGlyph} aria-hidden>
                            ⚠
                          </span>
                          <span>{String(x)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {aiStrengths.length > 0 ? (
                  <div className={styles.strategyValoracionBlock}>
                    <h4 className={styles.strategyStrengthsHeading}>Fortalezas</h4>
                    <ul className={styles.strategyStrengthList}>
                      {aiStrengths.map((x, i) => (
                        <li key={i} className={styles.strategyStrengthItem}>
                          <span className={styles.strategyStrengthGlyph} aria-hidden>
                            ✓
                          </span>
                          <span>{String(x)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className={styles.strategyEmptyHint}>
                <p>
                  {lastAnalysis
                    ? 'No hay valoración detallada guardada. Ejecuta de nuevo «Analizar con IA» para regenerar riesgos, fortalezas y plan de acción.'
                    : 'Aún no hay análisis. Usa «Analizar con IA» en la barra superior para obtener la valoración, riesgos, fortalezas y próximos pasos priorizados.'}
                </p>
              </div>
            )}

            {strategyCritical.length > 0 ? (
              <div className={styles.strategyCardCriticalWrap}>
                <h3 className={styles.strategySectionTitleCritical}>🔴 Acciones críticas — Próximos pasos</h3>
                <div className={styles.strategyActionList}>
                  {strategyCritical.map((row) => {
                    const badgeScore = Math.min(
                      10,
                      Math.max(0, Math.round(scores[row.dimensionKey] ?? row.score)),
                    );
                    return (
                      <div key={`crit-${row.dimensionKey}`} className={styles.strategyActionCardCritical}>
                        <div className={styles.strategyActionCardHead}>
                          <span className={styles.strategyActionEmoji} aria-hidden>
                            {row.emoji}
                          </span>
                          <span className={styles.strategyActionDimName}>{row.name}</span>
                          <span className={styles.strategyActionBadgeCritical}>{badgeScore}/10</span>
                        </div>
                        <p className={styles.strategyActionAdvice}>{row.advice}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {strategyAreas.length > 0 ? (
              <div className={styles.strategyCardAmberWrap}>
                <h3 className={styles.strategySectionTitleAmber}>🟡 Áreas a reforzar</h3>
                <div className={styles.strategyActionList}>
                  {strategyAreas.map((row) => {
                    const badgeScore = Math.min(
                      10,
                      Math.max(0, Math.round(scores[row.dimensionKey] ?? row.score)),
                    );
                    return (
                      <div key={`area-${row.dimensionKey}`} className={styles.strategyActionCardAmber}>
                        <div className={styles.strategyActionCardHead}>
                          <span className={styles.strategyActionEmoji} aria-hidden>
                            {row.emoji}
                          </span>
                          <span className={styles.strategyActionDimName}>{row.name}</span>
                          <span className={styles.strategyActionBadgeAmber}>{badgeScore}/10</span>
                        </div>
                        <p className={styles.strategyActionAdvice}>{row.advice}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {aiNext.length > 0 ? (
              <div className={styles.strategyCardQuestions}>
                <h3 className={styles.strategySectionTitleQuestions}>💬 Preguntas para el próximo seguimiento</h3>
                <p className={styles.strategyQuestionsTagline}>
                  <span aria-hidden>🤖</span> Generadas por IA basándose en los gaps del deal
                </p>
                <ul className={styles.strategyQuestionList}>
                  {aiNext.map((x, i) => (
                    <li key={i} className={styles.strategyQuestionItem}>
                      <span className={styles.strategyQuestionArrow} aria-hidden>
                        →
                      </span>
                      <p className={styles.strategyQuestionText}>{String(x)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <p className={styles.resultsMeta}>{`Escala de referencia por score: ${MEDDPICC_SCORE_LABELS[5]} (5) = punto medio.`}</p>
          </div>
        </>
      )}

      </div>

      {analyzeOpen && (
        <div
          className={styles.modalOverlay}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !analyzeBusy) setAnalyzeOpen(false);
          }}
        >
          <div
            className={`${styles.dimCard} ${styles.analyzeDialog} ${styles.modalPanel}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="analyze-title"
            aria-busy={analyzeBusy}
          >
            {analyzeBusy && (
              <div className={styles.analyzeBusyStrip} aria-hidden>
                <span className="sr-only">Análisis en curso</span>
              </div>
            )}
            <h2 id="analyze-title" className={styles.detailTitle}>
              {analyzeActionLabel}
            </h2>
            <p className={styles.dealCardMeta}>Añade contexto opcional (reunión, emails) para reevaluar el deal.</p>
            <textarea
              className={styles.textarea}
              rows={6}
              value={additionalCtx}
              onChange={(e) => setAdditionalCtx(e.target.value)}
              placeholder="Notas adicionales…"
              disabled={analyzeBusy}
            />
            <div className={styles.toolbar}>
              <button
                type="button"
                className={`${styles.primaryBtn} ${analyzeBusy ? styles.primaryBtnBusy : ''}`}
                disabled={analyzeBusy}
                onClick={() => void runAnalyze()}
              >
                {analyzeBusy ? (
                  <>
                    <span className={styles.primaryBtnSpinner} aria-hidden />
                    Analizando…
                  </>
                ) : (
                  lastAnalysis ? 'Ejecutar re-análisis' : 'Ejecutar análisis'
                )}
              </button>
              <button type="button" className={styles.ghostBtn} disabled={analyzeBusy} onClick={() => setAnalyzeOpen(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showStaleCornerPanel ? (
        <div
          className={styles.staleCornerPanel}
          role="region"
          aria-labelledby={staleCornerTitleId}
          aria-live="polite"
        >
          <div className={styles.staleCornerPanelInner}>
            <h2 id={staleCornerTitleId} className={styles.staleCornerTitle}>
              Información del deal actualizada
            </h2>
            <p className={styles.staleCornerBody}>
              Has modificado respuestas de la evaluación desde el último análisis con IA. Se recomienda volver a
              analizar el deal para alinear la estrategia, riesgos y próximos pasos con la información actual.
            </p>
            <div className={styles.staleCornerActions}>
              <button
                type="button"
                className={styles.staleCornerBtnSecondary}
                onClick={() => setStaleDismissAnswersFingerprint(answersFingerprint)}
              >
                Cerrar
              </button>
              <button
                type="button"
                className={`${styles.primaryBtn} ${styles.staleCornerBtnPrimary}`}
                onClick={() => {
                  setStaleDismissAnswersFingerprint(null);
                  setAnalyzeOpen(true);
                }}
              >
                Re-analizar con IA
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={convaiEndModalOpen}
        title={convaiEndModalLoading ? 'Sesión de voz finalizando…' : 'Sesión de voz finalizada'}
        description={convaiEndModalDescription}
        cancelLabel="Cerrar"
        confirmLabel="Entendido"
        onConfirm={closeConvaiEndModal}
        onCancel={closeConvaiEndModal}
      />

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
