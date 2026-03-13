'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { Activation } from '@/types/activation';
import { StatusTag } from '@/components/StatusTag/StatusTag';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import styles from './detail.module.css';

export default function ActivationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [activation, setActivation] = useState<Activation | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    if (!id) return;
    apiFetch(`/api/activations/${id}`)
      .then((r) => {
        if (r.status === 401) {
          window.location.href = '/login';
          return null;
        }
        if (!r.ok) return null;
        return r.json();
      })
      .then(setActivation)
      .finally(() => setLoading(false));
  }, [id]);

  const handleSend = async () => {
    if (!id) return;
    setError('');
    setSending(true);
    try {
      const res = await apiFetch(`/api/activations/${id}/send`, { method: 'POST' });
      if (res.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? 'Error al solicitar envío');
        return;
      }
      setActivation(data);
      router.refresh();
    } finally {
      setSending(false);
    }
  };

  const canSend = activation && (activation.status === 'DRAFT' || activation.status === 'ERROR');

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
    let failed = false;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        const res = await apiFetch(`/api/activations/${id}/attachments/upload`, { method: 'POST', body: formData });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setUploadError(data.message ?? 'Error al subir archivo');
          failed = true;
          break;
        }
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
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? 'Error al eliminar');
        return;
      }
      router.push('/activations');
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <p className={styles.loading}>Cargando…</p>;
  if (!activation) return <p className={styles.error}>Activation no encontrada.</p>;

  const section = (title: string, children: React.ReactNode) => (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <div className={styles.sectionContent}>{children}</div>
    </div>
  );

  let urls: string[] = [];
  if (activation.attachmentUrls) {
    try {
      urls = JSON.parse(activation.attachmentUrls);
    } catch {
      urls = activation.attachmentUrls.split(/[\n,]/).map((u) => u.trim()).filter(Boolean);
    }
  }

  return (
    <main className={styles.page}>
      <Link href="/activations" className={styles.back}>
        ← Mis activaciones
      </Link>
      <div className={styles.header}>
        <h1 className={styles.title}>{activation.projectName}</h1>
        <StatusTag status={activation.status} />
      </div>

      {section(
        'Proyecto y oferta',
        <>
          <p><strong>Proyecto:</strong> {activation.projectName}</p>
          {activation.client && <p><strong>Cliente:</strong> {activation.client}</p>}
          <p><strong>Código oferta:</strong> {activation.offerCode}</p>
          {activation.projectAmount != null && activation.projectAmount !== '' && (
            <p><strong>Importe:</strong> {activation.projectAmount}</p>
          )}
          {activation.projectType && (
            <p><strong>Tipo:</strong> {activation.projectType === 'CONSULTORIA' ? 'Consultoría' : 'Software'}</p>
          )}
          {activation.hubspotUrl && (
            <p><strong>HubSpot:</strong> <a href={activation.hubspotUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>{activation.hubspotUrl}</a></p>
          )}
        </>
      )}
      {section(
        'Destinatarios',
        <>
          <p><strong>To:</strong> {activation.recipientTo}</p>
          {activation.recipientCc && <p><strong>CC:</strong> {activation.recipientCc}</p>}
        </>
      )}
      {section('Asunto', <p><strong>{activation.subject}</strong></p>)}
      {section(
        'Áreas involucradas',
        (activation.activationAreas?.length || activation.activationSubAreas?.length) ? (
          <ul className={styles.list}>
            {activation.activationAreas?.map((aa) => (
              <li key={`area-${aa.area.id}`}>{aa.area.name}</li>
            ))}
            {activation.activationSubAreas?.map((asa) => (
              <li key={`sub-${asa.subArea.id}`}>{asa.subArea.area.name} › {asa.subArea.name}</li>
            ))}
          </ul>
        ) : (
          <p style={{ color: 'var(--fiori-text-secondary)', margin: 0 }}>Sin áreas asignadas</p>
        )
      )}
      {activation.body && section('Cuerpo del correo', <pre className={styles.pre}>{activation.body}</pre>)}
      {urls.length > 0 &&
        section(
          'URLs recopiladas',
          <ul className={styles.list}>
            {urls.map((url, i) => (
              <li key={i}>
                <a href={url} target="_blank" rel="noopener noreferrer" className={styles.link}>{url}</a>
              </li>
            ))}
          </ul>
        )}
      {activation.attachments && activation.attachments.length > 0 &&
        section(
          'Archivos adjuntos',
          <ul className={styles.list}>
            {activation.attachments.map((att) => (
              <li key={att.id}>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={async () => {
                    const res = await apiFetch(`/api/activations/${activation.id}/attachments/${att.id}`);
                    if (!res.ok) return;
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = att.fileName;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  {att.fileName} (descargar)
                </button>
              </li>
            ))}
          </ul>
        )}
      {section(
        'Añadir archivos',
        <>
          <p style={{ margin: '0 0 var(--fiori-space-2)', fontSize: '0.875rem', color: 'var(--fiori-text-secondary)' }}>
            Si los enlaces son de HubSpot, ábrelos con tu sesión, descarga los archivos en tu ordenador y súbelos aquí.
          </p>
          <label className={styles.linkButton} style={{ display: 'inline-block', cursor: uploading ? 'not-allowed' : 'pointer' }}>
            <input type="file" multiple disabled={uploading} onChange={handleFileUpload} style={{ display: 'none' }} />
            {uploading ? 'Subiendo…' : 'Seleccionar archivos'}
          </label>
          {uploadError && <p className={styles.errorMsg} style={{ marginTop: 'var(--fiori-space-1)' }}>{uploadError}</p>}
        </>
      )}
      {section(
        'Metadatos',
        <>
          <p><strong>Creado:</strong> {new Date(activation.createdAt).toLocaleString('es')}</p>
          <p><strong>Creado por:</strong> {activation.createdBy}</p>
          {activation.makeSentAt && <p><strong>Enviado (Make):</strong> {new Date(activation.makeSentAt).toLocaleString('es')}</p>}
          {activation.makeRunId && <p><strong>Run ID:</strong> {activation.makeRunId}</p>}
          {activation.errorMessage && <p className={styles.errorMsg}><strong>Error:</strong> {activation.errorMessage}</p>}
        </>
      )}

      {error && <p className={styles.errorMsg}>{error}</p>}
      <div className={styles.actions}>
        {activation.status === 'DRAFT' && (
          <Link href={`/activations/${id}/edit`} className={styles.btnSecondary}>
            Editar borrador
          </Link>
        )}
        {canSend && (
          <button type="button" onClick={handleSend} disabled={sending} className={styles.btnPrimary}>
            {sending ? 'Enviando…' : 'Enviar activación'}
          </button>
        )}
        <button type="button" onClick={handleDeleteClick} disabled={deleting} className={styles.btnDanger}>
          {deleting ? 'Eliminando…' : 'Eliminar'}
        </button>
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
    </main>
  );
}
