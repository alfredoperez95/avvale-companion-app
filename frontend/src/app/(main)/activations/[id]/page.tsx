'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { Activation } from '@/types/activation';
import { StatusTag } from '@/components/StatusTag/StatusTag';
import styles from './detail.module.css';

export default function ActivationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [activation, setActivation] = useState<Activation | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

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
      {section(
        'Asunto y plantilla',
        <>
          <p><strong>Asunto:</strong> {activation.subject}</p>
          <p><strong>Plantilla:</strong> {activation.templateCode}</p>
        </>
      )}
      {activation.body && section('Cuerpo del correo', <pre className={styles.pre}>{activation.body}</pre>)}
      {urls.length > 0 &&
        section(
          'Adjuntos',
          <ul className={styles.list}>
            {urls.map((url, i) => (
              <li key={i}>
                <a href={url} target="_blank" rel="noopener noreferrer" className={styles.link}>{url}</a>
              </li>
            ))}
          </ul>
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
      </div>
    </main>
  );
}
