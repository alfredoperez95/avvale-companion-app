'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch, redirectToLogin } from '@/lib/api';
import { ApproveSealFilesUploader } from '@/components/yubiq/DropzoneUploader/ApproveSealFilesUploader';
import { AnalysisLogPanel } from '@/components/yubiq/AnalysisLogPanel/AnalysisLogPanel';
import { ExtractionResultCard } from '@/components/yubiq/ExtractionResultCard/ExtractionResultCard';
import type {
  AnalyzeOfferResponse,
  AnthropicModelChoice,
  AreaCompania,
  ClaudeOfferExtraction,
  TranslateOfferResponse,
  UserAnthropicCredentialStatus,
} from '@/types/yubiq';
import { isDialogEnterTargetInteractive } from '@/lib/dialog-keyboard';
import { buildYubiqPayload, dispatchYubiqToExtensionAndWait } from '@/lib/yubiq';
import { fileToBase64Payload, storeLocalFilesInExtension } from '@/lib/browser-extension';
import { PageBreadcrumb, PageBackLink, PageHero, ChevronBackIcon } from '@/components/page-hero';
import type { YubiqExtensionFilesBlock } from '@/types/yubiq-payload';
import styles from './page.module.css';

function analysisBusyLabel(phase: 'uploading' | 'extracting' | 'analyzing'): string {
  switch (phase) {
    case 'uploading':
      return 'Subiendo documento';
    case 'extracting':
      return 'Extrayendo texto del PDF';
    default:
      return 'Analizando con Claude';
  }
}

function analysisBusyHint(phase: 'uploading' | 'extracting' | 'analyzing'): string {
  switch (phase) {
    case 'uploading':
      return 'Enviando archivos de forma segura…';
    case 'extracting':
      return 'Preparando el contenido para el modelo…';
    default:
      return 'Estructurando título, cliente, importe y área…';
  }
}

function createClientBatchId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Icono de idioma / traducción (trazo Fiori, coherente con el panel). */
function TranslateToEnglishGlyph() {
  return (
    <span className={styles.translateBtnInner} aria-hidden>
      <svg
        className={styles.translateBtnIcon}
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20" />
        <ellipse cx="12" cy="12" rx="4" ry="10" />
      </svg>
      <span className={styles.translateBtnLabel}>EN</span>
    </span>
  );
}

function StatusBadge({
  credLoading,
  configured,
  phase,
}: {
  credLoading: boolean;
  configured: boolean;
  phase: 'idle' | 'uploading' | 'extracting' | 'analyzing' | 'done' | 'error';
}) {
  if (credLoading) {
    return (
      <span className={`${styles.badge} ${styles.badgeBusy}`}>
        <span className={styles.badgeDot} />
        Comprobando credenciales…
      </span>
    );
  }
  if (phase === 'uploading' || phase === 'extracting' || phase === 'analyzing') {
    return (
      <span className={`${styles.badge} ${styles.badgeBusy}`}>
        <span className={styles.badgeDot} />
        Procesando PDF…
      </span>
    );
  }
  if (phase === 'error') {
    return (
      <span className={`${styles.badge} ${styles.badgeErr}`}>
        <span className={styles.badgeDot} />
        Error en el análisis
      </span>
    );
  }
  if (phase === 'done') {
    return (
      <span className={`${styles.badge} ${styles.badgeOk}`}>
        <span className={styles.badgeDot} />
        Análisis completado
      </span>
    );
  }
  if (!configured) {
    return (
      <span className={`${styles.badge} ${styles.badgeWarn}`}>
        <span className={styles.badgeDot} />
        Falta API key de Anthropic
      </span>
    );
  }
  return (
    <span className={`${styles.badge} ${styles.badgeOk}`}>
      <span className={styles.badgeDot} />
      Listo para analizar
    </span>
  );
}

type FlowStepState = 'todo' | 'current' | 'done';

function FlowStepper({
  hasPdf,
  phase,
  hasResult,
  yubiqBridge,
}: {
  hasPdf: boolean;
  phase: 'idle' | 'uploading' | 'extracting' | 'analyzing' | 'done' | 'error';
  hasResult: boolean;
  yubiqBridge: 'idle' | 'pending' | 'success' | 'error' | 'no_extension';
}) {
  const analyzing = phase === 'uploading' || phase === 'extracting' || phase === 'analyzing';
  const step1: FlowStepState = hasPdf || hasResult || analyzing || phase === 'done' ? 'done' : 'current';
  const step2: FlowStepState = hasResult || phase === 'done'
    ? 'done'
    : analyzing
      ? 'current'
      : hasPdf
        ? 'current'
        : 'todo';
  const step3: FlowStepState =
    yubiqBridge === 'success' ? 'done' : hasResult ? 'current' : 'todo';

  const steps: { id: string; label: string; hint: string; state: FlowStepState }[] = [
    { id: '1', label: 'Documento', hint: 'PDF y PFE', state: step1 },
    { id: '2', label: 'Análisis', hint: 'Claude', state: step2 },
    { id: '3', label: 'Yubiq', hint: 'Approve & Seal', state: step3 },
  ];

  return (
    <ol className={styles.flowStepper} aria-label="Progreso del flujo">
      {steps.map((step, index) => (
        <li
          key={step.id}
          className={`${styles.flowStep} ${
            step.state === 'done'
              ? styles.flowStepDone
              : step.state === 'current'
                ? styles.flowStepCurrent
                : styles.flowStepTodo
          }`}
          aria-current={step.state === 'current' ? 'step' : undefined}
        >
          <span className={styles.flowStepIndex} aria-hidden>
            {step.state === 'done' ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              step.id
            )}
          </span>
          <span className={styles.flowStepText}>
            <span className={styles.flowStepLabel}>{step.label}</span>
            <span className={styles.flowStepHint}>{step.hint}</span>
          </span>
          {index < steps.length - 1 ? (
            <span
              className={`${styles.flowStepConnector} ${
                step.state === 'done' ? styles.flowStepConnectorDone : ''
              }`}
              aria-hidden
            />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function AnalysisPhaseTrack({
  phase,
}: {
  phase: 'uploading' | 'extracting' | 'analyzing';
}) {
  const items: { id: typeof phase; label: string }[] = [
    { id: 'uploading', label: 'Subida' },
    { id: 'extracting', label: 'Extracción' },
    { id: 'analyzing', label: 'Claude' },
  ];
  const order = { uploading: 0, extracting: 1, analyzing: 2 } as const;
  const current = order[phase];

  return (
    <ol className={styles.phaseTrack} aria-label="Fases del análisis">
      {items.map((item, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'todo';
        return (
          <li
            key={item.id}
            className={`${styles.phaseTrackItem} ${
              state === 'done'
                ? styles.phaseTrackDone
                : state === 'current'
                  ? styles.phaseTrackCurrent
                  : styles.phaseTrackTodo
            }`}
            aria-current={state === 'current' ? 'step' : undefined}
          >
            <span className={styles.phaseTrackIndex} aria-hidden>
              {state === 'done' ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                index + 1
              )}
            </span>
            <span className={styles.phaseTrackLabel}>{item.label}</span>
            {index < items.length - 1 ? (
              <span
                className={`${styles.phaseTrackConnector} ${state === 'done' ? styles.phaseTrackConnectorDone : ''}`}
                aria-hidden
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export default function YubiqApproveSealFillerPage() {
  const router = useRouter();
  const [credentialStatus, setCredentialStatus] = useState<UserAnthropicCredentialStatus | null>(null);
  const [credLoading, setCredLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [pfeFile, setPfeFile] = useState<File | null>(null);
  const [model, setModel] = useState<AnthropicModelChoice>('haiku');
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'extracting' | 'analyzing' | 'done' | 'error'>('idle');
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<ClaudeOfferExtraction | null>(null);
  const [rawClaudeJson, setRawClaudeJson] = useState<string>('');
  const [error, setError] = useState('');
  const [lastFileName, setLastFileName] = useState('');
  const [promptPreview, setPromptPreview] = useState('');
  const [yubiqBridge, setYubiqBridge] = useState<'idle' | 'pending' | 'success' | 'error' | 'no_extension'>('idle');
  const [yubiqBridgeMessage, setYubiqBridgeMessage] = useState('');
  const [yubiqMarginModal, setYubiqMarginModal] = useState<'closed' | 'ask' | 'input'>('closed');
  const [yubiqManualMarginInput, setYubiqManualMarginInput] = useState('');
  const [translatedExtraction, setTranslatedExtraction] = useState<ClaudeOfferExtraction | null>(null);
  const [translatedRawClaudeJson, setTranslatedRawClaudeJson] = useState('');
  const [translateLoading, setTranslateLoading] = useState(false);
  const [translateError, setTranslateError] = useState('');
  const [secondaryAreas, setSecondaryAreas] = useState<AreaCompania[]>([]);
  const resultsSectionRef = useRef<HTMLElement | null>(null);
  const yubiqMarginInputRef = useRef<HTMLInputElement | null>(null);

  const displayResult = translatedExtraction ?? result;
  const displayRawClaudeJson = translatedExtraction ? translatedRawClaudeJson : rawClaudeJson;

  const handleAreaChange = (area: AreaCompania | null) => {
    setResult((prev) => (prev ? { ...prev, areaCompania: area } : prev));
    setTranslatedExtraction((prev) => (prev ? { ...prev, areaCompania: area } : prev));
    if (area) {
      setSecondaryAreas((prev) => prev.filter((item) => item !== area));
    }
  };

  const handleSecondaryAreasChange = (areas: AreaCompania[]) => {
    setSecondaryAreas(areas);
  };

  const canAnalyze = Boolean(file) && Boolean(credentialStatus?.configured) && phase !== 'uploading' && phase !== 'extracting' && phase !== 'analyzing';

  const isAnalysisBusy = phase === 'uploading' || phase === 'extracting' || phase === 'analyzing';

  const modelLabel = useMemo(() => {
    if (model === 'opus') return 'Opus';
    if (model === 'sonnet') return 'Sonnet';
    return 'Haiku';
  }, [model]);

  useEffect(() => {
    apiFetch('/api/user/ai-credentials/anthropic')
      .then((r) => {
        if (r.status === 401) {
          redirectToLogin();
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((data) => setCredentialStatus(data))
      .finally(() => setCredLoading(false));
  }, []);

  useLayoutEffect(() => {
    if (yubiqMarginModal !== 'input') return;
    const el = yubiqMarginInputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [yubiqMarginModal]);

  useEffect(() => {
    if (phase !== 'done') return;
    const el = resultsSectionRef.current;
    if (!el) return;
    const reduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    });
  }, [phase]);

  const runAnalyze = async () => {
    if (!file) return;
    setError('');
    setResult(null);
    setRawClaudeJson('');
    setTranslatedExtraction(null);
    setTranslatedRawClaudeJson('');
    setTranslateError('');
    setSecondaryAreas([]);
    setLastFileName('');
    setPromptPreview('');
    setLog([]);
    if (!credentialStatus?.configured) {
      setError('Falta configurar la API key de Anthropic en tu perfil.');
      setPhase('error');
      return;
    }

    setPhase('uploading');
    setLog((prev) => [...prev, 'Uploading PDF…']);
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 150_000);
      const fd = new FormData();
      fd.append('file', file);
      if (pfeFile) fd.append('pfe', pfeFile);
      fd.append('model', model);
      setPhase('analyzing');
      setLog((prev) => [
        ...prev,
        `Enviando PDF (${Math.round(file.size / 1024)} KB)…`,
        ...(pfeFile ? [`Enviando PFE (${Math.round(pfeFile.size / 1024)} KB)…`] : []),
        `Analyzing with Claude (${modelLabel})…`,
      ]);
      try {
        const res = await apiFetch('/api/yubiq/approve-seal-filler/analyze', {
          method: 'POST',
          body: fd,
          signal: controller.signal,
        });
        const data = (await res.json().catch(() => null)) as AnalyzeOfferResponse | null;
        if (res.status === 401) {
          redirectToLogin();
          return;
        }
        if (!res.ok || !data) {
          setError((data as { message?: string })?.message ?? 'No se pudo analizar el PDF.');
          setPhase('error');
          return;
        }
        setLog(data.log ?? []);
        setResult(data.result);
        setRawClaudeJson(data.rawClaudeJson ?? '');
        setTranslatedExtraction(null);
        setTranslatedRawClaudeJson('');
        setTranslateError('');
        setLastFileName(data.fileName ?? file?.name ?? 'document.pdf');
        setPromptPreview(data.promptPreview ?? '');
        setPhase('done');
      } finally {
        window.clearTimeout(timeout);
      }
    } catch (e) {
      const msg =
        e instanceof DOMException && e.name === 'AbortError'
          ? 'El análisis ha superado el tiempo máximo local.'
          : e instanceof Error
            ? e.message
            : String(e);
      setError(msg);
      setPhase('error');
    }
  };

  const runTranslate = async () => {
    if (!result) return;
    setTranslateError('');
    setTranslateLoading(true);
    try {
      const res = await apiFetch('/api/yubiq/approve-seal-filler/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extraction: result, model }),
      });
      const data = (await res.json().catch(() => null)) as TranslateOfferResponse | { message?: string } | null;
      if (res.status === 401) {
        redirectToLogin();
        return;
      }
      if (!res.ok || !data || !('result' in data)) {
        const raw = (data as { message?: string | string[] })?.message;
        const msg = Array.isArray(raw) ? raw.join('; ') : raw;
        setTranslateError(msg ?? 'No se pudo traducir.');
        return;
      }
      setTranslatedExtraction(data.result);
      setTranslatedRawClaudeJson(data.rawClaudeJson);
    } catch (e) {
      setTranslateError(e instanceof Error ? e.message : String(e));
    } finally {
      setTranslateLoading(false);
    }
  };

  const sendToYubiq = async (manualMargin?: string) => {
    if (!result) return;
    if (!file) {
      setYubiqBridge('error');
      setYubiqBridgeMessage('Falta el PDF de la oferta para enviarlo a Yubiq.');
      return;
    }
    const extractionForYubiq = translatedExtraction ?? result;
    setYubiqMarginModal('closed');
    setYubiqBridge('pending');
    setYubiqBridgeMessage('');
    try {
      const batchId = createClientBatchId();
      const localFiles = [
        await fileToBase64Payload(file, 'offer_pdf'),
        ...(pfeFile ? [await fileToBase64Payload(pfeFile, 'pfe_excel')] : []),
      ];
      const stored = await storeLocalFilesInExtension({ batchId, files: localFiles });
      if (!stored.ok) {
        setYubiqBridge(stored.timedOut ? 'no_extension' : 'error');
        setYubiqBridgeMessage(
          stored.error === 'payload_too_large'
            ? 'La extensión no pudo almacenar los archivos: alguno supera el tamaño máximo permitido.'
            : stored.timedOut
              ? 'La extensión no respondió al almacenamiento de archivos. Actualiza o activa Avvale Companion y recarga esta página.'
              : 'La extensión no pudo almacenar los archivos para Yubiq. Actualiza Avvale Companion e inténtalo de nuevo.',
        );
        return;
      }
      const extensionFiles: YubiqExtensionFilesBlock = {
        batchId,
        files: localFiles.map(({ role, name, mimeType, size }) => ({ role, name, mimeType, size })),
      };
      const { payload } = buildYubiqPayload({
        extraction: extractionForYubiq,
        fileName: lastFileName || file?.name || 'document.pdf',
        extensionFiles,
        ...(manualMargin !== undefined ? { manualMargin } : {}),
      });
      const detail = await dispatchYubiqToExtensionAndWait(payload, { timeoutMs: 8000 });
      if (detail.ok) {
        setYubiqBridge('success');
        setYubiqBridgeMessage('Solicitud enviada a la extensión. Se abrirá Yubiq en una pestaña nueva.');
        return;
      }
      if (detail.error === 'extension_timeout') {
        setYubiqBridge('no_extension');
        setYubiqBridgeMessage(
          'No se detectó la extensión Avvale Companion. Instálala en Chrome y recarga esta página, o usa el popup de la extensión para pegar el JSON.',
        );
        return;
      }
      setYubiqBridge('error');
      setYubiqBridgeMessage(detail.error ?? 'No se pudo completar el envío.');
    } catch (e) {
      setYubiqBridge('error');
      const message = e instanceof Error ? e.message : String(e);
      setYubiqBridgeMessage(
        message === 'payload_too_large'
          ? 'La extensión no pudo almacenar los archivos: alguno supera el tamaño máximo permitido.'
          : message,
      );
    }
  };

  useEffect(() => {
    if (yubiqMarginModal === 'closed') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (yubiqBridge !== 'pending') setYubiqMarginModal('closed');
        return;
      }
      if (e.key === 'Enter') {
        if (yubiqBridge === 'pending') return;
        if (isDialogEnterTargetInteractive(e.target)) return;
        e.preventDefault();
        if (yubiqMarginModal === 'ask') setYubiqMarginModal('input');
        else void sendToYubiq(yubiqManualMarginInput);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [yubiqMarginModal, yubiqBridge, yubiqManualMarginInput, sendToYubiq]);

  return (
    <main className={styles.page}>
      <PageBreadcrumb>
        <PageBackLink href="/launcher">
          <ChevronBackIcon />
          App Launcher
        </PageBackLink>
      </PageBreadcrumb>

      <PageHero
        title="Yubiq Approve & Seal Filler"
        subtitle="De la oferta PDF a Yubiq en tres pasos: carga el documento, deja que Claude estructure los datos y envíalos a Approve & Seal."
      />

      <div className={styles.toolbarRow}>
        <div className={styles.progressRail}>
          <FlowStepper
            hasPdf={Boolean(file)}
            phase={phase}
            hasResult={Boolean(result)}
            yubiqBridge={yubiqBridge}
          />
          <StatusBadge
            credLoading={credLoading}
            configured={Boolean(credentialStatus?.configured)}
            phase={phase}
          />
        </div>
      </div>

      <section className={styles.primaryCard} aria-label="Carga y análisis">
        <div className={styles.cardSection}>
          <div className={styles.sectionHeadInline}>
            <h2 className={styles.sectionTitle}>Documento</h2>
            <span className={styles.sectionMeta}>PDF obligatorio · PFE opcional · máx. 20 MB</span>
          </div>
          <ApproveSealFilesUploader
            pdfFile={file}
            pfeFile={pfeFile}
            disabled={phase === 'uploading' || phase === 'extracting' || phase === 'analyzing'}
            onPdfFileSelected={(f) => {
              setFile(f);
              setError('');
              setPhase('idle');
            }}
            onPfeFileSelected={(f) => {
              setPfeFile(f);
              setError('');
              setPhase('idle');
            }}
            onPdfFileCleared={() => {
              setFile(null);
              setError('');
              setPhase('idle');
            }}
            onPfeFileCleared={() => {
              setPfeFile(null);
              setError('');
              setPhase('idle');
            }}
          />
        </div>

        <div className={styles.analysisToolbar}>
          <div className={styles.modelField}>
            <span className={styles.modelFieldLabel} id="yubiq-model-label">
              Modelo
            </span>
            <div
              className={styles.modelSeg}
              role="radiogroup"
              aria-labelledby="yubiq-model-label"
            >
              {(
                [
                  { value: 'haiku', label: 'Haiku' },
                  { value: 'sonnet', label: 'Sonnet' },
                  { value: 'opus', label: 'Opus' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={model === opt.value}
                  className={`${styles.modelSegBtn} ${model === opt.value ? styles.modelSegBtnActive : ''}`}
                  disabled={phase === 'uploading' || phase === 'extracting' || phase === 'analyzing'}
                  onClick={() => setModel(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.actionsBar}>
            <button type="button" className={styles.btnPrimary} onClick={runAnalyze} disabled={!canAnalyze}>
              <span>
                {phase === 'uploading'
                  ? 'Subiendo…'
                  : phase === 'extracting' || phase === 'analyzing'
                    ? 'Analizando…'
                    : 'Analizar PDF'}
              </span>
              <img
                src="/img/Claude_AI_symbol.svg"
                alt=""
                width={16}
                height={16}
                className={styles.primaryBtnClaudeIcon}
                aria-hidden
              />
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => {
                setFile(null);
                setPfeFile(null);
                setResult(null);
                setRawClaudeJson('');
                setLastFileName('');
                setPromptPreview('');
                setLog([]);
                setError('');
                setYubiqBridge('idle');
                setYubiqBridgeMessage('');
                setYubiqMarginModal('closed');
                setYubiqManualMarginInput('');
                setTranslatedExtraction(null);
                setTranslatedRawClaudeJson('');
                setTranslateError('');
                setSecondaryAreas([]);
                setPhase('idle');
              }}
              disabled={phase === 'uploading' || phase === 'extracting' || phase === 'analyzing'}
            >
              Limpiar
            </button>
          </div>
        </div>

        {!credLoading && !credentialStatus?.configured && (
          <div className={styles.cardAlerts}>
            <p className={styles.notice}>
              No hay API key de Anthropic. Configúrala en{' '}
              <strong>
                <Link href="/profile">Perfil → AI Credentials</Link>
              </strong>
              .
            </p>
          </div>
        )}

        {error ? (
          <div className={styles.cardAlerts}>
            <p className={styles.error}>{error}</p>
          </div>
        ) : null}

        {isAnalysisBusy ? (
          <div className={styles.analysisLoading} role="status" aria-live="polite">
            <div className={styles.analysisLoadingMain}>
              <span className={styles.analysisSpinner} aria-hidden />
              <div className={styles.analysisLoadingCopy}>
                <span className={styles.analysisLoadingText}>
                  {analysisBusyLabel(phase as 'uploading' | 'extracting' | 'analyzing')}
                </span>
                <span className={styles.analysisLoadingHint}>
                  {analysisBusyHint(phase as 'uploading' | 'extracting' | 'analyzing')}
                </span>
              </div>
            </div>
            <AnalysisPhaseTrack phase={phase as 'uploading' | 'extracting' | 'analyzing'} />
          </div>
        ) : null}

        <div className={styles.primaryCardFooter}>
          <details className={styles.promptPreview}>
            <summary className={styles.promptSummary}>Vista previa del prompt (Claude)</summary>
            {promptPreview ? (
              <pre className={styles.promptPre} tabIndex={0}>
                {promptPreview}
              </pre>
            ) : (
              <p className={styles.promptEmpty}>
                Tras un análisis correcto, aquí verás el prompt enviado al modelo.
              </p>
            )}
          </details>
          <div className={styles.footerMeta}>
            <button
              type="button"
              className={styles.credentialsLink}
              onClick={() => router.push('/profile')}
              aria-label="Abrir perfil: credenciales API"
            >
              Credenciales
            </button>
            <span className={styles.footerMetaSep} aria-hidden>
              ·
            </span>
            <p className={styles.promptPreviewLead}>API key del perfil · datos sensibles no se reutilizan</p>
          </div>
        </div>
      </section>

      <section
        ref={resultsSectionRef}
        id="yubiq-approve-seal-results"
        className={`${styles.grid} ${result ? styles.gridReady : ''}`}
        aria-label="Resultados y registro"
      >
        <article className={`${styles.panel} ${styles.panelPrimary}`}>
          <div className={styles.panelHeader}>
            <div className={styles.panelHeaderMain}>
              <div className={styles.panelTitleBlock}>
                <div className={styles.panelTitleRow}>
                  <h2 className={styles.panelTitle}>Datos extraídos</h2>
                  {result ? (
                    <span className={styles.panelStatusPill}>Listo para enviar</span>
                  ) : null}
                </div>
                {result && lastFileName ? (
                  <p className={styles.panelSubtitle} title={lastFileName}>
                    {lastFileName}
                  </p>
                ) : (
                  <p className={styles.panelSubtitle}>
                    {result
                      ? 'Revisa los campos y envía a Yubiq'
                      : 'Aparecerán aquí tras un análisis correcto'}
                  </p>
                )}
              </div>
            </div>
            <div className={styles.panelHeaderActions}>
              <button
                type="button"
                className={styles.translateBtn}
                aria-label="Traducir datos extraídos al inglés"
                title="Traducir al inglés"
                disabled={!result || translateLoading}
                aria-busy={translateLoading}
                aria-pressed={Boolean(translatedExtraction)}
                onClick={() => void runTranslate()}
              >
                {translateLoading ? (
                  <span className={styles.translateBtnSpinner} aria-hidden />
                ) : (
                  <TranslateToEnglishGlyph />
                )}
              </button>
            </div>
          </div>
          {translateError ? <p className={styles.translateError}>{translateError}</p> : null}
          {result ? (
            <>
              <ExtractionResultCard
                result={displayResult}
                rawClaudeJson={displayRawClaudeJson}
                onAreaChange={handleAreaChange}
                secondaryAreas={secondaryAreas}
                onSecondaryAreasChange={handleSecondaryAreasChange}
              />
              <div className={styles.sendToYubiqWrap}>
                <button
                  type="button"
                  className={styles.btnSendYubiq}
                  data-avvale-action="send-yubiq"
                  disabled={!result || yubiqBridge === 'pending'}
                  onClick={() => {
                    const extractedMargin = (translatedExtraction ?? result)?.margenPorcentaje;
                    if (extractedMargin != null) {
                      void sendToYubiq(String(extractedMargin));
                      return;
                    }
                    setYubiqManualMarginInput('');
                    setYubiqMarginModal('ask');
                  }}
                >
                  {yubiqBridge === 'pending' ? 'Enviando a Yubiq…' : 'Enviar a Yubiq Approve & Seal'}
                </button>
                {yubiqBridgeMessage && (
                  <p
                    className={
                      yubiqBridge === 'success'
                        ? styles.bridgeOk
                        : yubiqBridge === 'no_extension'
                          ? styles.bridgeWarn
                          : styles.bridgeErr
                    }
                    role="status"
                  >
                    {yubiqBridgeMessage}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className={styles.empty}>
              <span className={styles.emptyIcon} aria-hidden>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </span>
              <p className={styles.emptyTitle}>Aún no hay extracción</p>
              <p className={styles.emptyBody}>
                Sube un PDF, elige el modelo y pulsa <strong>Analizar PDF</strong>. Verás título, cliente, importe, área
                Avvale, resumen y observaciones.
              </p>
            </div>
          )}
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelHeaderMain}>
              <span className={styles.panelIcon} aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="4 17 10 11 4 5" />
                  <line x1="12" y1="19" x2="20" y2="19" />
                </svg>
              </span>
              <div className={styles.panelTitleBlock}>
                <h2 className={styles.panelTitle}>Registro</h2>
                <p className={styles.panelSubtitle}>Traza del proceso y mensajes de la extensión</p>
              </div>
            </div>
          </div>
          <AnalysisLogPanel log={log} phase={phase} />
        </article>
      </section>

      {yubiqMarginModal !== 'closed' ? createPortal(
        <div
          className={styles.marginModalBackdrop}
          role="presentation"
          onClick={() => yubiqBridge !== 'pending' && setYubiqMarginModal('closed')}
        >
          <div
            className={styles.marginModalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby={
              yubiqMarginModal === 'ask' ? 'yubiq-margin-ask-title' : 'yubiq-margin-input-title'
            }
            onClick={(e) => e.stopPropagation()}
          >
            {yubiqMarginModal === 'ask' && (
              <>
                <h2 id="yubiq-margin-ask-title" className={styles.marginModalTitle}>
                  ¿Quieres definir el margen manualmente?
                </h2>
                <p className={styles.marginModalDesc}>
                  Si eliges <strong>No</strong>, se enviará sin margen a Yubiq A&amp;S. Si eliges <strong>Sí</strong>,
                  podrás introducirlo antes de enviar.
                </p>
                <div className={styles.marginModalActions}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    disabled={yubiqBridge === 'pending'}
                    onClick={() => void sendToYubiq()}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    disabled={yubiqBridge === 'pending'}
                    onClick={() => setYubiqMarginModal('input')}
                  >
                    Sí
                  </button>
                </div>
              </>
            )}
            {yubiqMarginModal === 'input' && (
              <>
                <h2 id="yubiq-margin-input-title" className={styles.marginModalTitle}>
                  Margen manual
                </h2>
                <p className={styles.marginModalDesc}>
                  Introduce un valor entre <strong>0</strong> y <strong>100</strong>. Puedes usar porcentaje o decimales; lo
                  redondearemos automáticamente al valor válido más cercano, ya que Yubiq A&amp;S solo acepta valores enteros
                  sin decimal.
                </p>
                <div className={styles.marginModalField}>
                  <label htmlFor="yubiq-manual-margin" className={styles.fieldLabel}>
                    Margen
                  </label>
                  <input
                    ref={yubiqMarginInputRef}
                    id="yubiq-manual-margin"
                    type="text"
                    className={styles.marginModalInput}
                    value={yubiqManualMarginInput}
                    onChange={(e) => setYubiqManualMarginInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      if (yubiqBridge === 'pending') return;
                      void sendToYubiq(yubiqManualMarginInput);
                    }}
                    placeholder="Ej: 35 - 35% - 35,4%"
                    autoComplete="off"
                  />
                </div>
                <div className={styles.marginModalActions}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    disabled={yubiqBridge === 'pending'}
                    onClick={() => setYubiqMarginModal('ask')}
                  >
                    Atrás
                  </button>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    disabled={yubiqBridge === 'pending'}
                    onClick={() => void sendToYubiq(yubiqManualMarginInput)}
                  >
                    Enviar a Yubiq
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body,
      ) : null}
    </main>
  );
}
