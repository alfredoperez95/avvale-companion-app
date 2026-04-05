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
import { parseAttachmentNames, parseAttachmentUrls } from '@/lib/activation-attachment-urls';
import { shouldWarnScannedUrlsOnly } from '@/lib/activation-attachment-warning';
import { PageBreadcrumb, PageBackLink, PageHero } from '@/components/page-hero';
import styles from './detail.module.css';

function isHtmlBody(body: string | null | undefined): boolean {
  return Boolean(body?.trim().startsWith('<'));
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
  const errorMessageDisplay = displayActivationErrorMessage(activation.errorMessage);

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
                Los enlaces de HubSpot no se abren automáticamente con tu sesión desde aquí. Usa el botón siguiente para abrirlos en pestañas, descarga con tu usuario y luego súbelos en &quot;Añadir archivos&quot;.
              </p>
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => attachmentList.forEach(({ url }) => window.open(url, '_blank', 'noopener'))}
              >
                Descargar todos los adjuntos
              </button>
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
    </main>
  );
}
