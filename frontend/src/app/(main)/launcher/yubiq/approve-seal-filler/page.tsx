'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { DropzoneUploader } from '@/components/yubiq/DropzoneUploader/DropzoneUploader';
import { AnalysisLogPanel } from '@/components/yubiq/AnalysisLogPanel/AnalysisLogPanel';
import { ExtractionResultCard } from '@/components/yubiq/ExtractionResultCard/ExtractionResultCard';
import type { AnalyzeOfferResponse, AnthropicModelChoice, ClaudeOfferExtraction, UserAnthropicCredentialStatus } from '@/types/yubiq';
import { buildYubiqPayload, dispatchYubiqToExtensionAndWait } from '@/lib/yubiq';
import styles from './page.module.css';

function ChevronBackIcon() {
  return (
    <span className={styles.backIcon} aria-hidden>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </span>
  );
}

function analysisBusyLabel(phase: 'uploading' | 'extracting' | 'analyzing'): string {
  switch (phase) {
    case 'uploading':
      return 'Subiendo PDF…';
    case 'extracting':
      return 'Extrayendo texto…';
    default:
      return 'Analizando con Claude…';
  }
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

export default function YubiqApproveSealFillerPage() {
  const router = useRouter();
  const [credentialStatus, setCredentialStatus] = useState<UserAnthropicCredentialStatus | null>(null);
  const [credLoading, setCredLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
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
  const resultsSectionRef = useRef<HTMLElement | null>(null);

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
          window.location.href = '/login';
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((data) => setCredentialStatus(data))
      .finally(() => setCredLoading(false));
  }, []);

  useEffect(() => {
    if (yubiqMarginModal === 'closed') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setYubiqMarginModal('closed');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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
      const fd = new FormData();
      fd.append('file', file);
      fd.append('model', model);
      setPhase('analyzing');
      setLog((prev) => [...prev, `Analyzing with Claude (${modelLabel})…`]);
      const res = await apiFetch('/api/yubiq/approve-seal-filler/analyze', {
        method: 'POST',
        body: fd,
      });
      const data = (await res.json().catch(() => null)) as AnalyzeOfferResponse | null;
      if (res.status === 401) {
        window.location.href = '/login';
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
      setLastFileName(data.fileName ?? file?.name ?? 'document.pdf');
      setPromptPreview(data.promptPreview ?? '');
      setPhase('done');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setPhase('error');
    }
  };

  const sendToYubiq = async (manualMargin?: string) => {
    if (!result) return;
    setYubiqMarginModal('closed');
    setYubiqBridge('pending');
    setYubiqBridgeMessage('');
    try {
      const { payload } = buildYubiqPayload({
        extraction: result,
        fileName: lastFileName || file?.name || 'document.pdf',
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
      setYubiqBridgeMessage(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Migas de pan">
        <Link href="/launcher" className={styles.back}>
          <ChevronBackIcon />
          App Launcher
        </Link>
      </nav>

      <header className={styles.hero}>
        <h1 className={styles.h1}>Yubiq Approve &amp; Seal Filler</h1>
        <p className={styles.subtitle}>
          Sube una oferta comercial en PDF, extráe texto y obtén con Claude un resumen estructurado: cliente, importe, área Avvale y más.
        </p>
      </header>

      <div className={styles.statusRow}>
        <StatusBadge credLoading={credLoading} configured={Boolean(credentialStatus?.configured)} phase={phase} />
      </div>

      <section className={styles.primaryCard} aria-label="Carga y análisis">
        <div className={styles.primaryCardRow}>
          <div className={styles.cardSection}>
            <div className={styles.sectionHead}>
              <span className={styles.stepBadge} aria-hidden>
                1
              </span>
              <div>
                <h2 className={styles.sectionTitle}>Documento</h2>
                <p className={styles.sectionDesc}>Arrastra un PDF o elige un archivo desde tu equipo (máx. 20&nbsp;MB).</p>
              </div>
            </div>
            <DropzoneUploader
              file={file}
              disabled={phase === 'uploading' || phase === 'extracting' || phase === 'analyzing'}
              onFileSelected={(f) => {
                if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
                  setError('Selecciona un archivo PDF.');
                  setPhase('error');
                  return;
                }
                setFile(f);
                setError('');
                setPhase('idle');
              }}
            />
          </div>

          <div className={`${styles.cardSection} ${styles.cardSectionMuted}`}>
            <div className={styles.sectionHead}>
              <span className={styles.stepBadge} aria-hidden>
                2
              </span>
              <div>
                <h2 className={styles.sectionTitle}>Modelo y ejecución</h2>
                <p className={styles.sectionDesc}>Elige la variante de Claude y ejecuta el análisis.</p>
              </div>
            </div>

            <div className={styles.actionStrip}>
              <div className={styles.field}>
                <label htmlFor="yubiq-model" className={styles.fieldLabel}>
                  Modelo
                </label>
                <select
                  id="yubiq-model"
                  className={styles.select}
                  value={model}
                  onChange={(e) => setModel(e.target.value as AnthropicModelChoice)}
                  disabled={phase === 'uploading' || phase === 'extracting' || phase === 'analyzing'}
                  aria-label="Seleccionar modelo de Claude"
                >
                  <option value="haiku">Haiku (rápido, recomendado)</option>
                  <option value="sonnet">Sonnet</option>
                  <option value="opus">Opus</option>
                </select>
              </div>

              <div className={styles.actionsToolbar}>
                <div className={styles.actionsMain}>
                  <button type="button" className={styles.btnPrimary} onClick={runAnalyze} disabled={!canAnalyze}>
                    {phase === 'uploading'
                      ? 'Subiendo…'
                      : phase === 'extracting' || phase === 'analyzing'
                        ? 'Analizando…'
                        : 'Analizar PDF'}
                  </button>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => {
                      setFile(null);
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
                      setPhase('idle');
                    }}
                    disabled={phase === 'uploading' || phase === 'extracting' || phase === 'analyzing'}
                  >
                    Limpiar
                  </button>
                </div>
                <div className={styles.credentialsCell}>
                  <button
                    type="button"
                    className={styles.profileLink}
                    onClick={() => router.push('/profile')}
                    aria-label="Abrir perfil: credenciales API"
                  >
                    Credenciales API
                  </button>
                </div>
              </div>
            </div>

            {!credLoading && !credentialStatus?.configured && (
              <p className={styles.notice}>
                No hay API key de Anthropic guardada. Configúrala en{' '}
                <strong>
                  <Link href="/profile">Perfil → AI Credentials</Link>
                </strong>
                .
              </p>
            )}

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.analysisMiddle}>
              {isAnalysisBusy && (
                <div className={styles.analysisLoading} role="status" aria-live="polite">
                  <span className={styles.analysisSpinner} aria-hidden />
                  <span className={styles.analysisLoadingText}>
                    {analysisBusyLabel(phase as 'uploading' | 'extracting' | 'analyzing')}
                  </span>
                </div>
              )}
            </div>

            <div className={styles.promptPreviewFooter}>
              <p className={styles.promptPreviewLead}>
                Los datos sensibles usan tu API key guardada en el perfil.
              </p>
              <details className={styles.promptPreview}>
                <summary className={styles.promptSummary}>Vista previa del prompt (Claude)</summary>
                {promptPreview ? (
                  <pre className={styles.promptPre} tabIndex={0}>
                    {promptPreview}
                  </pre>
                ) : (
                  <p className={styles.promptEmpty}>
                    Tras un análisis correcto, aquí verás el prompt completo enviado al modelo (incluye el texto extraído del
                    PDF).
                  </p>
                )}
              </details>
            </div>
          </div>
        </div>
      </section>

      <section
        ref={resultsSectionRef}
        id="yubiq-approve-seal-results"
        className={styles.grid}
        aria-label="Resultados y registro"
      >
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelIcon} aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </span>
            <h2 className={styles.panelTitle}>Datos extraídos</h2>
          </div>
          {result ? (
            <ExtractionResultCard result={result} rawClaudeJson={rawClaudeJson} />
          ) : (
            <div className={styles.empty}>
              Aquí verás título, cliente, importe, área Avvale, resumen y observaciones cuando completes un análisis correctamente.
            </div>
          )}
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelIcon} aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="4 17 10 11 4 5" />
                <line x1="12" y1="19" x2="20" y2="19" />
              </svg>
            </span>
            <h2 className={styles.panelTitle}>Registro</h2>
          </div>
          <AnalysisLogPanel log={log} phase={phase} />
          <div className={styles.sendToYubiqWrap}>
            <button
              type="button"
              className={styles.btnSendYubiq}
              data-avvale-action="send-yubiq"
              disabled={!result || yubiqBridge === 'pending'}
              onClick={() => {
                setYubiqManualMarginInput('');
                setYubiqMarginModal('ask');
              }}
            >
              {yubiqBridge === 'pending' ? 'Enviando…' : 'Enviar a Yubiq'}
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
        </article>
      </section>

      {yubiqMarginModal !== 'closed' && (
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
                  ¿Deseas indicar el margen manualmente?
                </h2>
                <p className={styles.marginModalDesc}>
                  Si eliges <strong>No</strong>, se enviará el JSON a la extensión sin margen manual. Si eliges{' '}
                  <strong>Sí</strong>, podrás escribir el valor antes de enviar.
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
                  Valor entre <strong>0</strong> y <strong>100</strong> (p. ej. porcentaje). Puedes usar <code>%</code> o
                  decimales: se <strong>redondean</strong> al entero más cercano y se acotan al rango. En el JSON va como{' '}
                  <code>manualMargin</code> (entero).
                </p>
                <div className={styles.marginModalField}>
                  <label htmlFor="yubiq-manual-margin" className={styles.fieldLabel}>
                    Margen
                  </label>
                  <input
                    id="yubiq-manual-margin"
                    type="text"
                    className={styles.marginModalInput}
                    value={yubiqManualMarginInput}
                    onChange={(e) => setYubiqManualMarginInput(e.target.value)}
                    placeholder="Ej. 15, 15 % o 35,8"
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
        </div>
      )}
    </main>
  );
}
