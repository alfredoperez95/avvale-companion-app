'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { Activation } from '@/types/activation';
import { StatusTag } from '@/components/StatusTag/StatusTag';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { AttachmentGrid } from '@/components/AttachmentGrid/AttachmentGrid';
import { formatActivationCode } from '@/lib/activation-code';
import styles from './DetailDrawer.module.css';

interface DetailDrawerProps {
  activationId: string | null;
  onClose: () => void;
  onUpdated?: (activation: Activation) => void;
  onDeleted?: () => void;
}

function parseAttachmentUrls(attachmentUrls: string | null): string[] {
  if (!attachmentUrls) return [];
  try {
    const parsed = JSON.parse(attachmentUrls);
    return Array.isArray(parsed) ? parsed : [attachmentUrls];
  } catch {
    return attachmentUrls.split(/[\n,]/).map((u) => u.trim()).filter(Boolean);
  }
}

function parseAttachmentNames(attachmentNames: string | null): string[] {
  if (!attachmentNames) return [];
  try {
    const parsed = JSON.parse(attachmentNames);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function DetailDrawer({ activationId, onClose, onUpdated, onDeleted }: DetailDrawerProps) {
  const [activation, setActivation] = useState<Activation | null>(null);
  const [loading, setLoading] = useState(!!activationId);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEmailBody, setShowEmailBody] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!activationId) {
      setActivation(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    apiFetch(`/api/activations/${activationId}`)
      .then((r) => {
        if (r.status === 401) {
          window.location.href = '/login';
          return null;
        }
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        setActivation(data);
      })
      .finally(() => setLoading(false));
  }, [activationId]);

  const handleSend = async () => {
    if (!activationId) return;
    setError('');
    setSending(true);
    try {
      const res = await apiFetch(`/api/activations/${activationId}/send`, { method: 'POST' });
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
      onUpdated?.(data);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteClick = () => setShowDeleteConfirm(true);

  const handleDeleteConfirm = async () => {
    if (!activationId || !activation) return;
    setShowDeleteConfirm(false);
    setError('');
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/activations/${activationId}`, { method: 'DELETE' });
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
      onDeleted?.();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => setShowDeleteConfirm(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  if (!activationId) return null;

  const section = (title: string, children: React.ReactNode) => (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <div className={styles.sectionContent}>{children}</div>
    </div>
  );

  return (
    <>
      <div
        className={styles.overlay}
        onClick={onClose}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label="Cerrar panel"
      />
      <div
        className={styles.drawer}
        role="dialog"
        aria-labelledby="drawer-title"
        onKeyDown={handleKeyDown}
      >
        <div className={styles.header}>
          <div className={styles.headerTitles}>
            <h2 id="drawer-title" className={styles.title}>
              {loading ? 'Cargando…' : activation?.projectName ?? 'Detalle'}
            </h2>
            {!loading && activation && (
              <p className={styles.subtitle}>
                {formatActivationCode(activation.activationNumber)} · n.º {activation.activationNumber}
              </p>
            )}
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        <div className={styles.body}>
          {loading && <p className={styles.sectionContent}>Cargando…</p>}
          {!loading && activation && (
            <>
              <div className={styles.section}>
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
                    <p>
                      <strong>HubSpot:</strong>{' '}
                      <a href={activation.hubspotUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>
                        {activation.hubspotUrl}
                      </a>
                    </p>
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
              {section('Asunto', <p style={{ margin: 0 }}><strong>{activation.subject}</strong></p>)}
              {section(
                'Áreas involucradas',
                (activation.activationAreas?.length || activation.activationSubAreas?.length) ? (
                  <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
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
              {activation.body && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Cuerpo del correo</h3>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => setShowEmailBody((v) => !v)}
                    aria-expanded={showEmailBody}
                  >
                    {showEmailBody ? 'Ocultar email' : 'Mostrar email'}
                  </button>
                  {showEmailBody && (
                    <div className={`${styles.sectionContent} ${styles.sectionContentReveal}`}>
                      {/<[a-z][\s\S]*>/i.test(activation.body) ? (
                        <div className={styles.sectionContentBody} dangerouslySetInnerHTML={{ __html: activation.body }} />
                      ) : (
                        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{activation.body}</pre>
                      )}
                    </div>
                  )}
                </div>
              )}
              {(() => {
                const urls = parseAttachmentUrls(activation.attachmentUrls);
                const names = parseAttachmentNames(activation.attachmentNames);
                const attachmentList = urls.map((url, i) => ({ url, name: names[i]?.trim() || url }));
                return attachmentList.length > 0
                  ? section(
                      'URLs escaneadas',
                      <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                        {attachmentList.map(({ url, name }, i) => (
                          <li key={i}>
                            <a href={url} target="_blank" rel="noopener noreferrer" className={styles.link}>
                              {name}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )
                  : null;
              })()}
              {activation.attachments && activation.attachments.length > 0 &&
                section(
                  'Archivos adjuntos',
                  <AttachmentGrid
                    attachments={activation.attachments}
                    activationId={activation.id}
                    apiFetch={apiFetch}
                    onDeleted={() => {
                      apiFetch(`/api/activations/${activationId}`)
                        .then((r) => (r.ok ? r.json() : null))
                        .then((data) => data && setActivation(data));
                    }}
                  />
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
            </>
          )}
        </div>
        {!loading && activation && (
          <div className={styles.footer}>
            {activation.status === 'DRAFT' && (
              <Link href={`/launcher/activations/activate/${activationId}/edit`} className={styles.btn}>
                Editar borrador
              </Link>
            )}
            {(activation.status === 'DRAFT' || activation.status === 'ERROR') && (
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSend} disabled={sending}>
                {sending ? 'Enviando…' : 'Enviar activación'}
              </button>
            )}
            <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={handleDeleteClick} disabled={deleting}>
              {deleting ? 'Eliminando…' : 'Eliminar'}
            </button>
            {error && <span className={styles.errorMsg}>{error}</span>}
          </div>
        )}
      </div>
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Eliminar activación"
        message="¿Eliminar esta activación? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </>
  );
}
