'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

type Activation = {
  id: string;
  status: string;
  projectName: string;
  offerCode: string;
  hubspotUrl: string | null;
  recipientTo: string;
  recipientCc: string | null;
  subject: string;
  templateCode: string;
  createdAt: string;
  createdBy: string;
  makeSentAt: string | null;
  makeRunId: string | null;
  errorMessage: string | null;
};

const statusLabel: Record<string, string> = {
  DRAFT: 'Borrador',
  READY_TO_SEND: 'Listo para enviar',
  SENT: 'Enviado',
  ERROR: 'Error',
};

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

  if (loading) return <p style={{ padding: '2rem' }}>Cargando…</p>;
  if (!activation) return <p style={{ padding: '2rem' }}>Activation no encontrada.</p>;

  const section = (title: string, children: React.ReactNode) => (
    <div style={{ marginBottom: '1.5rem' }}>
      <h3 style={{ fontSize: '0.9rem', color: '#6a6d70', marginBottom: '0.5rem' }}>{title}</h3>
      <div style={{ background: '#f7f7f7', padding: '1rem', borderRadius: 6 }}>{children}</div>
    </div>
  );

  return (
    <main style={{ padding: '2rem', maxWidth: 720, margin: '0 auto' }}>
      <Link href="/activations" style={{ display: 'block', marginBottom: '1rem', color: '#0854a0' }}>
        ← Mis activaciones
      </Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h1 style={{ fontSize: '1.5rem' }}>{activation.projectName}</h1>
        <span
          style={{
            padding: '0.25rem 0.6rem',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 500,
            background: activation.status === 'SENT' ? '#e0f2e9' : activation.status === 'ERROR' ? '#fde8e8' : activation.status === 'READY_TO_SEND' ? '#fff4e5' : '#eee',
            color: activation.status === 'SENT' ? '#0d6832' : activation.status === 'ERROR' ? '#b00' : '#333',
          }}
        >
          {statusLabel[activation.status] ?? activation.status}
        </span>
      </div>

      {section('Proyecto y oferta', (
        <>
          <p><strong>Proyecto:</strong> {activation.projectName}</p>
          <p><strong>Código oferta:</strong> {activation.offerCode}</p>
          {activation.hubspotUrl && <p><strong>HubSpot:</strong> <a href={activation.hubspotUrl} target="_blank" rel="noopener noreferrer">{activation.hubspotUrl}</a></p>}
        </>
      ))}
      {section('Destinatarios', (
        <>
          <p><strong>To:</strong> {activation.recipientTo}</p>
          {activation.recipientCc && <p><strong>CC:</strong> {activation.recipientCc}</p>}
        </>
      ))}
      {section('Asunto y plantilla', (
        <>
          <p><strong>Asunto:</strong> {activation.subject}</p>
          <p><strong>Plantilla:</strong> {activation.templateCode}</p>
        </>
      ))}
      {section('Metadatos', (
        <>
          <p><strong>Creado:</strong> {new Date(activation.createdAt).toLocaleString('es')}</p>
          <p><strong>Creado por:</strong> {activation.createdBy}</p>
          {activation.makeSentAt && <p><strong>Enviado (Make):</strong> {new Date(activation.makeSentAt).toLocaleString('es')}</p>}
          {activation.makeRunId && <p><strong>Run ID:</strong> {activation.makeRunId}</p>}
          {activation.errorMessage && <p style={{ color: '#b00' }}><strong>Error:</strong> {activation.errorMessage}</p>}
        </>
      ))}

      {error && <p style={{ color: '#b00', marginBottom: '1rem' }}>{error}</p>}
      {canSend && (
        <button
          type="button"
          onClick={handleSend}
          disabled={sending}
          style={{
            padding: '0.6rem 1.2rem',
            background: '#0854a0',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: sending ? 'not-allowed' : 'pointer',
            fontWeight: 500,
          }}
        >
          {sending ? 'Enviando…' : 'Enviar activación'}
        </button>
      )}
    </main>
  );
}
