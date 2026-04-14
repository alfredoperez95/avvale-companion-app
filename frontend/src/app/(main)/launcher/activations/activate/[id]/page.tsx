'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, apiUpload, redirectToLogin } from '@/lib/api';
import type { Activation } from '@/types/activation';
import { StatusTag } from '@/components/StatusTag/StatusTag';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { AttachmentGrid } from '@/components/AttachmentGrid/AttachmentGrid';
import { formatActivationCode } from '@/lib/activation-code';
import { displayActivationErrorMessage } from '@/lib/activation-error-message';
import {
  isHubSpotAttachmentUrl,
  parseAttachmentNames,
  parseAttachmentUrls,
} from '@/lib/activation-attachment-urls';
import { shouldWarnScannedUrlsOnly } from '@/lib/activation-attachment-warning';
import { fetchUrlAsFileInBrowser } from '@/lib/activation-client-fetch-upload';
import {
  useActivationExtensionDownloads,
  type ExtensionDownloadPhase,
} from '@/hooks/useActivationExtensionDownloads';
import { PageBreadcrumb, PageBackLink, PageHero } from '@/components/page-hero';
import styles from './detail.module.css';

function isHtmlBody(body: string | null | undefined): boolean {
  return Boolean(body?.trim().startsWith('<'));
}

type ImportScannedUrlsResult = {
  saved: string[];
  failed: { url: string; error: string }[];
  skippedHubSpot: string[];
  skippedAlreadyPresent: string[];
};

type ClientImportResult =
  | {
      kind: 'done';
      saved: string[];
      failed: { url: string; error: string }[];
    }
  | { kind: 'nothingToImport'; message: string };

function extensionBridgeStatusText(
  phase: ExtensionDownloadPhase,
  errorMessage: string | null,
): string | null {
  if (phase === 'idle') return null;
  if (phase === 'error') return errorMessage ?? 'Error al usar la extensión.';
  if (phase === 'stale_batch' && errorMessage) return errorMessage;
  switch (phase) {
    case 'checking':
      return 'Comprobando extensión…';
    case 'downloading':
      return 'Descargando archivos con la sesión del navegador (extensión)…';
    case 'ready':
      return 'Archivos listos en la extensión. Pulsa «Cargar al flujo» para subirlos.';
    case 'uploading':
      return 'Subiendo archivos al servidor…';
    case 'done':
      return 'Archivos subidos.';
    default:
      return errorMessage;
  }
}

export default function ActivationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [activation, setActivation] = useState<Activation | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSendAttachmentWarning, setShowSendAttachmentWarning] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [sanitizedBody, setSanitizedBody] = useState<string | null>(null);
  const [importUrlsLoading, setImportUrlsLoading] = useState(false);
  const [importUrlsError, setImportUrlsError] = useState('');
  const [importResult, setImportResult] = useState<ImportScannedUrlsResult | null>(null);
  const [importClientLoading, setImportClientLoading] = useState(false);
  const [clientImportResult, setClientImportResult] = useState<ClientImportResult | null>(null);
  const [showDiscardExtensionConfirm, setShowDiscardExtensionConfirm] = useState(false);
  const [discardExtensionBusy, setDiscardExtensionBusy] = useState(false);
  const [showDeleteAllAttachmentsConfirm, setShowDeleteAllAttachmentsConfirm] = useState(false);
  const [deleteAllAttachmentsBusy, setDeleteAllAttachmentsBusy] = useState(false);
  const [bulkAttachmentsError, setBulkAttachmentsError] = useState('');

  const extensionBridge = useActivationExtensionDownloads();

  useEffect(() => {
    if (!id) return;
    apiFetch(`/api/activations/${id}`)
      .then((r) => {
        if (r.status === 401) {
          redirectToLogin();
          return null;
        }
        if (!r.ok) return null;
        return r.json();
      })
      .then(setActivation)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const body = activation?.body;
    if (!body || !isHtmlBody(body)) {
      setSanitizedBody(null);
      return;
    }
    let cancelled = false;
    import('dompurify').then(({ default: DOMPurify }) => {
      if (!cancelled) setSanitizedBody(DOMPurify.sanitize(body));
    });
    return () => { cancelled = true; };
  }, [activation?.body]);

  const performSend = async () => {
    if (!id) return;
    if (!activation?.body?.trim()) {
      setError('Debes seleccionar una plantilla (o definir el cuerpo del correo) antes de enviar.');
      return;
    }
    setError('');
    setSending(true);
    try {
      sessionStorage.setItem(`activation-send-started:${id}`, String(Date.now()));
    } catch {}
    router.push('/launcher/activations/activate');
    router.refresh();
    void apiFetch(`/api/activations/${id}/send`, { method: 'POST' })
      .catch(() => {});
  };
  const handleSend = async () => {
    if (!id || !activation) return;
    if (!activation.body?.trim()) {
      setError('Debes seleccionar una plantilla (o definir el cuerpo del correo) antes de enviar.');
      return;
    }
    if (shouldWarnScannedUrlsOnly(activation)) {
      setShowSendAttachmentWarning(true);
      return;
    }
    return performSend();
  };

  const canSendByStatus =
    activation &&
    (activation.status === 'DRAFT' ||
      activation.status === 'FAILED' ||
      activation.status === 'RETRYING');
  const hasTemplateOrBody = Boolean(activation?.body?.trim());

  const refetchActivation = () => {
    if (!id) return;
    apiFetch(`/api/activations/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setActivation);
  };

  useEffect(() => {
    if (extensionBridge.phase !== 'done' || !id) return;
    apiFetch(`/api/activations/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setActivation(data);
      });
    const t = window.setTimeout(() => extensionBridge.resetLocalState(), 400);
    return () => window.clearTimeout(t);
  }, [extensionBridge.phase, extensionBridge.resetLocalState, id]);

  const handleExtensionDownloadClick = () => {
    if (!activation) return;
    const already = new Set(
      (activation.attachments ?? []).map((a) => a.originalUrl.trim()).filter(Boolean),
    );
    const parsedUrls = parseAttachmentUrls(activation.attachmentUrls);
    const parsedNames = parseAttachmentNames(activation.attachmentNames);
    const toProcess = parsedUrls.map((u) => u.trim()).filter((u) => u && !already.has(u));
    const items = toProcess.map((url) => {
      const idx = parsedUrls.findIndex((u) => u.trim() === url);
      const suggestedName =
        idx >= 0 && parsedNames[idx]?.trim() ? parsedNames[idx]!.trim() : undefined;
      return { url, suggestedName };
    });
    void extensionBridge.startDownload(items);
  };

  const handleExtensionLoadClick = async () => {
    if (!id || !activation) return;
    setClientImportResult(null);
    const alreadyImportedOriginalUrls = new Set(
      (activation.attachments ?? []).map((a) => a.originalUrl?.trim()).filter(Boolean) as string[],
    );
    const out = await extensionBridge.uploadBatchToActivation(id, { alreadyImportedOriginalUrls });
    if (out.kind === 'success' || out.kind === 'partial') {
      refetchActivation();
    }
  };

  const handleDiscardExtensionConfirmed = async () => {
    setDiscardExtensionBusy(true);
    try {
      const r = await extensionBridge.discardExtensionTempFiles();
      if (!r.ok && r.message) {
        setImportUrlsError(r.message);
      }
    } finally {
      setDiscardExtensionBusy(false);
      setShowDiscardExtensionConfirm(false);
    }
  };

  const handleConfirmDeleteAllAttachments = async () => {
    if (!id || !activation?.attachments?.length) return;
    setBulkAttachmentsError('');
    setDeleteAllAttachmentsBusy(true);
    try {
      for (const att of activation.attachments) {
        const res = await apiFetch(`/api/activations/${id}/attachments/${att.id}`, { method: 'DELETE' });
        if (res.status === 401) {
          redirectToLogin();
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const msg = Array.isArray(data.message) ? data.message.join(', ') : data.message;
          setBulkAttachmentsError(msg ?? `No se pudo eliminar un adjunto (HTTP ${res.status}).`);
          return;
        }
      }
      setShowDeleteAllAttachmentsConfirm(false);
      refetchActivation();
    } catch (e) {
      setBulkAttachmentsError(e instanceof Error ? e.message : 'Error de red');
    } finally {
      setDeleteAllAttachmentsBusy(false);
    }
  };

  const handleImportScannedUrls = async () => {
    if (!id) return;
    setImportUrlsLoading(true);
    setImportUrlsError('');
    setImportResult(null);
    setClientImportResult(null);
    try {
      const res = await apiFetch(`/api/activations/${id}/attachments/import-scanned-urls`, {
        method: 'POST',
      });
      const data = (await res.json().catch(() => ({}))) as ImportScannedUrlsResult & {
        message?: string | string[];
      };
      if (res.status === 401) {
        redirectToLogin();
        return;
      }
      if (!res.ok) {
        const msg = Array.isArray(data.message) ? data.message.join(', ') : data.message;
        setImportUrlsError(msg ?? 'No se pudieron importar las URLs');
        return;
      }
      const normalized: ImportScannedUrlsResult = {
        saved: Array.isArray(data.saved) ? data.saved : [],
        failed: Array.isArray(data.failed) ? data.failed : [],
        skippedHubSpot: Array.isArray(data.skippedHubSpot) ? data.skippedHubSpot : [],
        skippedAlreadyPresent: Array.isArray(data.skippedAlreadyPresent) ? data.skippedAlreadyPresent : [],
      };
      setImportResult(normalized);
      if (normalized.saved.length > 0) {
        refetchActivation();
      }
    } catch (e) {
      setImportUrlsError(e instanceof Error ? e.message : 'Error de red');
    } finally {
      setImportUrlsLoading(false);
    }
  };

  const handleImportFromBrowser = async () => {
    if (!id || !activation) return;
    setImportClientLoading(true);
    setClientImportResult(null);
    setImportUrlsError('');
    setImportResult(null);
    try {
      const already = new Set(
        (activation.attachments ?? []).map((a) => a.originalUrl.trim()).filter(Boolean),
      );
      const parsedUrls = parseAttachmentUrls(activation.attachmentUrls);
      const parsedNames = parseAttachmentNames(activation.attachmentNames);
      const toProcess = parsedUrls.map((u) => u.trim()).filter((u) => u && !already.has(u));
      if (toProcess.length === 0) {
        setClientImportResult({
          kind: 'nothingToImport',
          message: 'Todas las URLs escaneadas ya tienen un adjunto asociado.',
        });
        return;
      }
      const saved: string[] = [];
      const failed: { url: string; error: string }[] = [];
      for (const url of toProcess) {
        const idx = parsedUrls.findIndex((u) => u.trim() === url);
        const displayName = (idx >= 0 && parsedNames[idx]?.trim()) || url;
        const fetched = await fetchUrlAsFileInBrowser(url, displayName);
        if (!fetched.ok) {
          failed.push({ url, error: fetched.error });
          continue;
        }
        const formData = new FormData();
        formData.append('file', fetched.file);
        formData.append('originalUrl', url);
        const res = await apiUpload(`/api/activations/${id}/attachments/upload`, formData);
        if (res.status === 401) {
          redirectToLogin();
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const msg = Array.isArray(data.message) ? data.message.join(', ') : data.message;
          failed.push({ url, error: msg ?? `Error al subir (HTTP ${res.status})` });
          continue;
        }
        saved.push(url);
      }
      setClientImportResult({ kind: 'done', saved, failed });
      if (saved.length > 0) {
        refetchActivation();
      }
    } catch (e) {
      setClientImportResult({
        kind: 'done',
        saved: [],
        failed: [{ url: '(general)', error: e instanceof Error ? e.message : 'Error desconocido' }],
      });
    } finally {
      setImportClientLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!id || !files?.length) return;
    setUploadError('');
    setUploading(true);
    setUploadProgress(0);
    let failed = false;
    const allFiles = Array.from(files);
    const totalBytes = allFiles.reduce((acc, file) => acc + Math.max(file.size, 1), 0);
    let uploadedBytes = 0;
    try {
      for (let i = 0; i < allFiles.length; i++) {
        const file = allFiles[i];
        const formData = new FormData();
        formData.append('file', file);
        const res = await apiUpload(`/api/activations/${id}/attachments/upload`, formData, (loaded) => {
          const current = uploadedBytes + loaded;
          setUploadProgress(Math.min(100, Math.round((current / totalBytes) * 100)));
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setUploadError(data.message ?? 'Error al subir archivo');
          failed = true;
          break;
        }
        uploadedBytes += Math.max(file.size, 1);
        setUploadProgress(Math.min(100, Math.round((uploadedBytes / totalBytes) * 100)));
      }
      if (!failed) refetchActivation();
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteClick = () => setShowDeleteConfirm(true);

  const handleDeleteConfirm = async () => {
    if (!id) return;
    setShowDeleteConfirm(false);
    setError('');
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/activations/${id}`, { method: 'DELETE' });
      if (res.status === 401) {
        localStorage.removeItem('token');
        redirectToLogin();
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? 'Error al eliminar');
        return;
      }
      router.push('/launcher/activations/activate');
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <main className={styles.page}>
        <p className={styles.loadingState}>Cargando activación…</p>
      </main>
    );
  }
  if (!activation) {
    return (
      <main className={styles.page}>
        <p className={styles.notFound}>Activación no encontrada.</p>
      </main>
    );
  }

  const section = (title: string, children: React.ReactNode) => (
    <section className={styles.sectionCard} aria-label={title}>
      <h3 className={styles.sectionHeading}>{title}</h3>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );

  const urls = parseAttachmentUrls(activation.attachmentUrls);
  const names = parseAttachmentNames(activation.attachmentNames);
  const attachmentList = urls.map((url, i) => ({ url, name: names[i]?.trim() || url }));
  const alreadyImportedForExtension = new Set(
    (activation.attachments ?? []).map((a) => a.originalUrl.trim()).filter(Boolean),
  );
  const extensionPendingCount = attachmentList.filter(
    ({ url }) => url.trim() && !alreadyImportedForExtension.has(url.trim()),
  ).length;
  const extensionBlockingBatch =
    extensionBridge.phase === 'ready' ||
    extensionBridge.phase === 'stale_batch' ||
    extensionBridge.phase === 'done';
  const urlImportBusy =
    importUrlsLoading || importClientLoading || uploading || extensionBridge.extensionBusy;
  const canExtensionDownload =
    extensionPendingCount > 0 &&
    !extensionBlockingBatch &&
    !urlImportBusy;
  const canExtensionLoad =
    (extensionBridge.phase === 'ready' || extensionBridge.phase === 'stale_batch') &&
    !extensionBridge.extensionBusy;
  const hasUploadedAttachments = (activation.attachments?.length ?? 0) > 0;
  const canDeleteUploadedAttachments =
    hasUploadedAttachments && !urlImportBusy && !deleteAllAttachmentsBusy;
  const allScannedAreHubSpot =
    attachmentList.length > 0 && attachmentList.every(({ url }) => isHubSpotAttachmentUrl(url));
  const errorMessageDisplay = displayActivationErrorMessage(activation.errorMessage);

  let importFeedbackClassName = styles.importFeedback;
  if (importUrlsError) {
    importFeedbackClassName = `${styles.importFeedback} ${styles.importFeedbackError}`;
  } else if (importResult) {
    const { saved, failed, skippedHubSpot, skippedAlreadyPresent } = importResult;
    if (failed.length > 0 && saved.length === 0) {
      importFeedbackClassName = `${styles.importFeedback} ${styles.importFeedbackError}`;
    } else if (failed.length > 0 && saved.length > 0) {
      importFeedbackClassName = `${styles.importFeedback} ${styles.importFeedbackWarning}`;
    } else if (
      saved.length === 0 &&
      failed.length === 0 &&
      skippedHubSpot.length > 0 &&
      skippedAlreadyPresent.length === 0
    ) {
      importFeedbackClassName = `${styles.importFeedback} ${styles.importFeedbackWarning}`;
    } else if (skippedHubSpot.length > 0 || skippedAlreadyPresent.length > 0) {
      importFeedbackClassName = `${styles.importFeedback} ${styles.importFeedbackWarning}`;
    } else if (saved.length > 0) {
      importFeedbackClassName = `${styles.importFeedback} ${styles.importFeedbackSuccess}`;
    } else {
      importFeedbackClassName = `${styles.importFeedback} ${styles.importFeedbackWarning}`;
    }
  }

  return (
    <main className={styles.page}>
      <PageBreadcrumb>
        <PageBackLink href="/launcher/activations/activate">← Mis activaciones</PageBackLink>
      </PageBreadcrumb>
      <PageHero
        title={activation.projectName}
        subtitle={`${formatActivationCode(activation.activationNumber)} · n.º ${activation.activationNumber}`}
        actions={<StatusTag status={activation.status} />}
      />

      {section(
        'Proyecto y oferta',
        <dl className={styles.kvList}>
          <div className={styles.kvRow}>
            <dt className={styles.kvDt}>Proyecto</dt>
            <dd className={styles.kvDd}>{activation.projectName}</dd>
          </div>
          {activation.client ? (
            <div className={styles.kvRow}>
              <dt className={styles.kvDt}>Cliente</dt>
              <dd className={styles.kvDd}>{activation.client}</dd>
            </div>
          ) : null}
          <div className={styles.kvRow}>
            <dt className={styles.kvDt}>Código oferta</dt>
            <dd className={styles.kvDd}>{activation.offerCode}</dd>
          </div>
          {activation.projectAmount != null && activation.projectAmount !== '' ? (
            <div className={styles.kvRow}>
              <dt className={styles.kvDt}>Importe</dt>
              <dd className={styles.kvDd}>{activation.projectAmount}</dd>
            </div>
          ) : null}
          {activation.projectType ? (
            <div className={styles.kvRow}>
              <dt className={styles.kvDt}>Tipo</dt>
              <dd className={styles.kvDd}>{activation.projectType === 'CONSULTORIA' ? 'Consultoría' : 'Software'}</dd>
            </div>
          ) : null}
          {activation.hubspotUrl ? (
            <div className={styles.kvRow}>
              <dt className={styles.kvDt}>HubSpot</dt>
              <dd className={styles.kvDd}>
                <a href={activation.hubspotUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>
                  {activation.hubspotUrl}
                </a>
              </dd>
            </div>
          ) : null}
        </dl>,
      )}
      {section(
        'Destinatarios',
        <dl className={styles.kvList}>
          <div className={styles.kvRow}>
            <dt className={styles.kvDt}>Para</dt>
            <dd className={styles.kvDd}>{activation.recipientTo}</dd>
          </div>
          {activation.recipientCc ? (
            <div className={styles.kvRow}>
              <dt className={styles.kvDt}>CC</dt>
              <dd className={styles.kvDd}>{activation.recipientCc}</dd>
            </div>
          ) : null}
        </dl>,
      )}
      {section(
        'Asunto',
        <p className={styles.subjectLine}>{activation.subject}</p>,
      )}
      {section(
        'Áreas involucradas',
        activation.activationAreas?.length || activation.activationSubAreas?.length ? (
          <ul className={styles.areaList}>
            {activation.activationAreas?.map((aa) => (
              <li key={`area-${aa.area.id}`}>{aa.area.name}</li>
            ))}
            {activation.activationSubAreas?.map((asa) => (
              <li key={`sub-${asa.subArea.id}`}>
                {asa.subArea.area.name} › {asa.subArea.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.emptyHint}>Sin áreas asignadas.</p>
        ),
      )}
      {activation.body
        ? section(
            'Cuerpo del correo',
            isHtmlBody(activation.body) ? (
              sanitizedBody != null ? (
                <div className={styles.bodyHtml} dangerouslySetInnerHTML={{ __html: sanitizedBody }} />
              ) : (
                <p className={styles.bodyLoading}>Cargando vista previa…</p>
              )
            ) : (
              <pre className={styles.pre}>{activation.body}</pre>
            ),
          )
        : null}
      {attachmentList.length > 0
        ? section(
            'URLs escaneadas',
            <>
              <ul className={styles.urlList}>
                {attachmentList.map(({ url, name }, i) => (
                  <li key={i}>
                    <a href={url} target="_blank" rel="noopener noreferrer" className={styles.link}>
                      {name}
                    </a>
                  </li>
                ))}
              </ul>
              <p className={styles.hint}>
                <strong>Importar al servidor</strong> descarga el archivo en el backend (solo enlaces públicos; HubSpot se
                omite). <strong>Desde el navegador (memoria)</strong> descarga el fichero en la RAM del navegador (sin
                carpeta temporal en disco) y lo sube: puede funcionar con URLs que permitan CORS; HubSpot suele bloquearlo
                por seguridad. <strong>Con la extensión Avvale Companion</strong> la descarga usa la sesión del navegador
                (sin carpeta de Descargas del sistema) y luego puedes subir los archivos a la activación. Si falla, usa
                &quot;Abrir enlaces&quot; y &quot;Añadir archivos&quot; manualmente.
              </p>
              {allScannedAreHubSpot ? (
                <p className={styles.hint}>
                  Todas las URLs son de HubSpot: el servidor no puede descargarlas. Puedes probar &quot;Desde el
                  navegador&quot; por si el enlace redirige a un archivo con CORS permitido; si no, descarga manual.
                </p>
              ) : null}
              <div className={styles.urlActions}>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  disabled={urlImportBusy || allScannedAreHubSpot}
                  onClick={() => void handleImportScannedUrls()}
                >
                  {importUrlsLoading ? 'Importando…' : 'Importar al servidor'}
                </button>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  disabled={urlImportBusy}
                  onClick={() => void handleImportFromBrowser()}
                >
                  {importClientLoading ? 'Descargando en memoria…' : 'Desde el navegador (memoria)'}
                </button>
                <button
                  type="button"
                  className={styles.linkButton}
                  disabled={urlImportBusy}
                  onClick={() => attachmentList.forEach(({ url }) => window.open(url, '_blank', 'noopener'))}
                >
                  Abrir enlaces en pestañas
                </button>
              </div>
              <div
                className={styles.extensionBridge}
                aria-live="polite"
                aria-atomic="true"
              >
                <div className={styles.urlActions}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    disabled={!canExtensionDownload}
                    onClick={() => handleExtensionDownloadClick()}
                  >
                    {extensionBridge.phase === 'checking' || extensionBridge.phase === 'downloading'
                      ? 'Descargando con extensión…'
                      : 'Descargar con extensión'}
                  </button>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    disabled={!canExtensionLoad}
                    onClick={() => void handleExtensionLoadClick()}
                  >
                    {extensionBridge.phase === 'uploading' ? 'Subiendo al flujo…' : 'Cargar al flujo'}
                  </button>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    disabled={!canDeleteUploadedAttachments}
                    onClick={() => {
                      setBulkAttachmentsError('');
                      setShowDeleteAllAttachmentsConfirm(true);
                    }}
                  >
                    {deleteAllAttachmentsBusy ? 'Eliminando…' : 'Eliminar adjuntos subidos'}
                  </button>
                  {extensionBridge.canDiscardTempFiles ? (
                    <button
                      type="button"
                      className={styles.linkButton}
                      disabled={discardExtensionBusy || extensionBridge.extensionBusy}
                      onClick={() => setShowDiscardExtensionConfirm(true)}
                    >
                      Descartar temporales de la extensión
                    </button>
                  ) : null}
                </div>
                {(() => {
                  const line = extensionBridgeStatusText(extensionBridge.phase, extensionBridge.errorMessage);
                  return line ? <p className={styles.extensionBridgeStatus}>{line}</p> : null;
                })()}
                {(extensionBridge.phase === 'checking' || extensionBridge.phase === 'downloading') ? (
                  <p className={styles.extensionBridgeWait}>
                    Esperando respuesta de la extensión: {extensionBridge.bridgeWaitSeconds} s /{' '}
                    {extensionBridge.downloadTimeoutSeconds} s
                    {process.env.NODE_ENV === 'development' ? (
                      <>
                        {' '}
                        — en consola (F12) busca mensajes{' '}
                        <code className={styles.inlineCode}>[AvvaleExtension]</code>
                      </>
                    ) : null}
                  </p>
                ) : null}
                {(extensionBridge.phase === 'checking' || extensionBridge.phase === 'downloading') &&
                extensionBridge.bridgeWaitSeconds >= 8 ? (
                  <p className={styles.extensionBridgeHint} role="status">
                    Si el tiempo sigue subiendo, la extensión no está contestando al evento{' '}
                    <code className={styles.inlineCode}>avvale-extension-request</code>. Hace falta implementar el puente
                    en el content script (respuesta con <code className={styles.inlineCode}>avvale-extension-response</code>
                    , mismo <code className={styles.inlineCode}>requestId</code> y{' '}
                    <code className={styles.inlineCode}>source: avvale-companion-extension</code>). Ver{' '}
                    <code className={styles.inlineCode}>docs/BROWSER_EXTENSION_BRIDGE.md</code>.
                  </p>
                ) : null}
                {extensionBridge.suggestUpdateExtension && extensionBridge.phase === 'error' ? (
                  <p className={styles.hint}>
                    Si la extensión está instalada, puede que necesites una versión más reciente que implemente el puente
                    de descargas (eventos <code className={styles.inlineCode}>avvale-extension-request</code>).
                  </p>
                ) : null}
                {bulkAttachmentsError ? (
                  <p className={styles.errorMsg} role="alert">
                    {bulkAttachmentsError}
                  </p>
                ) : null}
              </div>
              {importUrlsError ? (
                <div className={`${styles.importFeedback} ${styles.importFeedbackError}`} role="alert">
                  <p>{importUrlsError}</p>
                </div>
              ) : null}
              {importResult && !importUrlsError ? (
                <div className={importFeedbackClassName}>
                  {importResult.saved.length > 0 ? (
                    <p>
                      Se importaron {importResult.saved.length} archivo(s) al servidor; aparecen en &quot;Archivos
                      adjuntos&quot;.
                    </p>
                  ) : null}
                  {importResult.skippedAlreadyPresent.length > 0 ? (
                    <p>
                      {importResult.skippedAlreadyPresent.length} URL(s) ya estaban importadas (se omitieron).
                    </p>
                  ) : null}
                  {importResult.skippedHubSpot.length > 0 ? (
                    <p>
                      {importResult.skippedHubSpot.length} URL(s) apuntan a HubSpot: el servidor no puede descargarlas sin
                      tu sesión. Ábrelas con &quot;Abrir enlaces en pestañas&quot; o súbelas en &quot;Añadir archivos&quot;.
                    </p>
                  ) : null}
                  {importResult.failed.length > 0 ? (
                    <div>
                      <p>No se pudieron importar {importResult.failed.length} enlace(s):</p>
                      <ul className={styles.importFailedList}>
                        {importResult.failed.map((f) => (
                          <li key={f.url}>
                            {f.url} — {f.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {importResult.saved.length === 0 &&
                  importResult.failed.length === 0 &&
                  importResult.skippedHubSpot.length === 0 &&
                  importResult.skippedAlreadyPresent.length > 0 ? (
                    <p>No había URLs nuevas que importar.</p>
                  ) : null}
                </div>
              ) : null}
              {clientImportResult ? (
                <div
                  className={`${styles.importFeedback} ${
                    clientImportResult.kind === 'nothingToImport'
                      ? styles.importFeedbackWarning
                      : clientImportResult.saved.length === 0 && clientImportResult.failed.length > 0
                        ? styles.importFeedbackError
                        : clientImportResult.failed.length > 0
                          ? styles.importFeedbackWarning
                          : styles.importFeedbackSuccess
                  }`}
                >
                  {clientImportResult.kind === 'nothingToImport' ? (
                    <p>{clientImportResult.message}</p>
                  ) : (
                    <>
                      {clientImportResult.saved.length > 0 ? (
                        <p>
                          Desde el navegador se subieron {clientImportResult.saved.length} archivo(s) (memoria → servidor);
                          aparecen en &quot;Archivos adjuntos&quot;.
                        </p>
                      ) : null}
                      {clientImportResult.failed.length > 0 ? (
                        <div>
                          <p>No se pudo obtener o subir desde el navegador:</p>
                          <ul className={styles.importFailedList}>
                            {clientImportResult.failed.map((f) => (
                              <li key={f.url}>
                                {f.url} — {f.error}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}
            </>,
          )
        : null}
      {activation.attachments && activation.attachments.length > 0
        ? section(
            'Archivos adjuntos',
            <AttachmentGrid
              attachments={activation.attachments}
              activationId={activation.id}
              apiFetch={apiFetch}
              onDeleted={refetchActivation}
            />,
          )
        : null}
      {section(
        'Añadir archivos',
        <div className={styles.uploadZone}>
          <p className={styles.hint}>
            Para documentos detrás de HubSpot: primero ábrelos desde &quot;URLs escaneadas&quot;, guárdalos en tu equipo y súbelos aquí.
          </p>
          <label className={styles.linkButton} style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}>
            <input type="file" multiple disabled={uploading} onChange={handleFileUpload} style={{ display: 'none' }} />
            {uploading ? 'Subiendo…' : 'Seleccionar archivos'}
          </label>
          {uploading ? (
            <div className={styles.uploadProgressWrap} aria-live="polite">
              <div className={styles.uploadProgressBar} style={{ width: `${uploadProgress}%` }} />
              <span className={styles.uploadProgressText}>{uploadProgress}%</span>
            </div>
          ) : null}
          {uploadError ? <p className={styles.errorMsg}>{uploadError}</p> : null}
        </div>,
      )}
      {section(
        'Metadatos',
        <dl className={styles.kvList}>
          <div className={styles.kvRow}>
            <dt className={styles.kvDt}>Creado</dt>
            <dd className={styles.kvDd}>{new Date(activation.createdAt).toLocaleString('es')}</dd>
          </div>
          <div className={styles.kvRow}>
            <dt className={styles.kvDt}>Creado por</dt>
            <dd className={styles.kvDd}>{activation.createdBy}</dd>
          </div>
          {activation.makeSentAt ? (
            <div className={styles.kvRow}>
              <dt className={styles.kvDt}>Enviado (Make)</dt>
              <dd className={styles.kvDd}>{new Date(activation.makeSentAt).toLocaleString('es')}</dd>
            </div>
          ) : null}
          {activation.makeRunId ? (
            <div className={styles.kvRow}>
              <dt className={styles.kvDt}>Run ID</dt>
              <dd className={styles.kvDd}>{activation.makeRunId}</dd>
            </div>
          ) : null}
          {errorMessageDisplay ? (
            <div className={styles.kvRow}>
              <dt className={styles.kvDt}>Error</dt>
              <dd className={styles.kvDd}>
                <span className={styles.metadataErrorText}>{errorMessageDisplay}</span>
              </dd>
            </div>
          ) : null}
        </dl>,
      )}

      <div className={styles.stackErrors}>
        {error ? <p className={styles.errorMsg}>{error}</p> : null}
        {activation &&
        (activation.status === 'DRAFT' || activation.status === 'FAILED' || activation.status === 'RETRYING') &&
        !activation.body?.trim() ? (
          <p className={styles.inlineAlert}>
            Debes elegir una plantilla o definir el cuerpo del correo en el borrador antes de poder enviar.
          </p>
        ) : null}
      </div>
      <div className={styles.actionsBar}>
        <div className={styles.actionsPrimary}>
          {activation.status === 'DRAFT' ? (
            <Link href={`/launcher/activations/activate/${id}/edit`} className={styles.btnSecondary}>
              Editar borrador
            </Link>
          ) : null}
          {canSendByStatus ? (
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !hasTemplateOrBody}
              className={styles.btnPrimary}
            >
              {sending ? 'Enviando…' : 'Enviar activación'}
            </button>
          ) : null}
        </div>
        <div className={styles.actionsDanger}>
          <button type="button" onClick={handleDeleteClick} disabled={deleting} className={styles.btnDanger}>
            {deleting ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Eliminar activación"
        message="¿Eliminar esta activación? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
      />
      <ConfirmDialog
        open={showSendAttachmentWarning}
        title="No se han añadido adjuntos"
        message="No se han añadido adjuntos. Las URLs escaneadas solo serán accesibles por usuarios con acceso a HubSpot."
        confirmLabel="Enviar de todas formas"
        cancelLabel="Cancelar"
        confirmVariant="primary"
        onConfirm={() => {
          setShowSendAttachmentWarning(false);
          void performSend();
        }}
        onCancel={() => setShowSendAttachmentWarning(false)}
      />
      <ConfirmDialog
        open={showDiscardExtensionConfirm}
        title="Descartar archivos temporales"
        message="Se eliminarán los archivos guardados por la extensión para este lote. Los que no hayas subido a la activación se perderán."
        confirmLabel="Descartar"
        cancelLabel="Cancelar"
        variant="default"
        confirmBusy={discardExtensionBusy}
        busyLabel="Descartando…"
        onConfirm={() => void handleDiscardExtensionConfirmed()}
        onCancel={() => {
          if (!discardExtensionBusy) setShowDiscardExtensionConfirm(false);
        }}
      />
      <ConfirmDialog
        open={showDeleteAllAttachmentsConfirm}
        title="Eliminar adjuntos subidos"
        message={`Se eliminarán del servidor los ${activation.attachments?.length ?? 0} archivo(s) de esta activación. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar todos"
        cancelLabel="Cancelar"
        variant="danger"
        confirmBusy={deleteAllAttachmentsBusy}
        busyLabel="Eliminando…"
        onConfirm={() => void handleConfirmDeleteAllAttachments()}
        onCancel={() => {
          if (!deleteAllAttachmentsBusy) setShowDeleteAllAttachmentsConfirm(false);
        }}
      />
    </main>
  );
}
