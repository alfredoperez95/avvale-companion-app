'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { Activation } from '@/types/activation';
import { StatusTag } from '@/components/StatusTag';
import styles from './DetailDrawer.module.css';

interface DetailDrawerProps {
  activationId: string | null;
  onClose: () => void;
  onUpdated?: (activation: Activation) => void;
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

export function DetailDrawer({ activationId, onClose, onUpdated }: DetailDrawerProps) {
  const [activation, setActivation] = useState<Activation | null>(null);
  const [loading, setLoading] = useState(!!activationId);
  const [sending, setSending] = useState(false);
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
          <h2 id="drawer-title" className={styles.title}>
            {loading ? 'Cargando…' : activation?.projectName ?? 'Detalle'}
          </h2>
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
                  <p><strong>Código oferta:</strong> {activation.offerCode}</p>
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
              {section(
                'Asunto y plantilla',
                <>
                  <p><strong>Asunto:</strong> {activation.subject}</p>
                  <p><strong>Plantilla:</strong> {activation.templateCode}</p>
                </>
              )}
              {activation.body && section('Cuerpo del correo', <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{activation.body}</pre>)}
              {(() => {
                const urls = parseAttachmentUrls(activation.attachmentUrls);
                return urls.length > 0
                  ? section(
                      'Adjuntos',
                      <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                        {urls.map((url, i) => (
                          <li key={i}>
                            <a href={url} target="_blank" rel="noopener noreferrer" className={styles.link}>
                              {url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )
                  : null;
              })()}
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
              <Link href={`/activations/${activationId}/edit`} className={styles.btn}>
                Editar borrador
              </Link>
            )}
            {(activation.status === 'DRAFT' || activation.status === 'ERROR') && (
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSend} disabled={sending}>
                {sending ? 'Enviando…' : 'Enviar activación'}
              </button>
            )}
            {error && <span className={styles.errorMsg}>{error}</span>}
          </div>
        )}
      </div>
    </>
  );
}
