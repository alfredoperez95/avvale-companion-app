'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

const styles = {
  main: { padding: '2rem', maxWidth: 600, margin: '0 auto' as const },
  back: { marginBottom: '1.5rem', display: 'block', color: '#0854a0' },
  h1: { marginBottom: '1.5rem', fontSize: '1.5rem' },
  formGroup: { marginBottom: '1rem' },
  label: { display: 'block', marginBottom: 4, fontWeight: 500 },
  input: {
    width: '100%',
    padding: '0.5rem',
    border: '1px solid #ccc',
    borderRadius: 4,
    boxSizing: 'border-box' as const,
  },
  textarea: {
    width: '100%',
    padding: '0.5rem',
    border: '1px solid #ccc',
    borderRadius: 4,
    minHeight: 80,
    boxSizing: 'border-box' as const,
  },
  error: { color: '#b00', marginBottom: '1rem', fontSize: 14 },
  button: {
    padding: '0.6rem 1.2rem',
    background: '#0854a0',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    marginRight: '0.5rem',
  },
  buttonSecondary: {
    padding: '0.6rem 1.2rem',
    background: '#6a6d70',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
  },
};

export default function EditActivationPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [fetchLoading, setFetchLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    projectName: '',
    offerCode: '',
    hubspotUrl: '',
    recipientTo: '',
    recipientCc: '',
    subject: '',
    templateCode: '',
    body: '',
    attachmentUrlsText: '',
  });

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
      .then((data) => {
        if (!data) {
          setLoadError('No se pudo cargar la activación');
          return;
        }
        if (data.status !== 'DRAFT') {
          router.replace(`/activations/${id}`);
          return;
        }
        let urlsText = '';
        if (data.attachmentUrls) {
          try {
            const arr = JSON.parse(data.attachmentUrls);
            urlsText = Array.isArray(arr) ? arr.join('\n') : data.attachmentUrls;
          } catch {
            urlsText = data.attachmentUrls;
          }
        }
        setForm({
          projectName: data.projectName ?? '',
          offerCode: data.offerCode ?? '',
          hubspotUrl: data.hubspotUrl ?? '',
          recipientTo: data.recipientTo ?? '',
          recipientCc: data.recipientCc ?? '',
          subject: data.subject ?? '',
          templateCode: data.templateCode ?? '',
          body: data.body ?? '',
          attachmentUrlsText: urlsText,
        });
      })
      .catch(() => setLoadError('Error al cargar'))
      .finally(() => setFetchLoading(false));
  }, [id, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const attachmentUrls = form.attachmentUrlsText
        .split(/[\n,]/)
        .map((u) => u.trim())
        .filter(Boolean);
      const body = {
        projectName: form.projectName.trim(),
        offerCode: form.offerCode.trim(),
        hubspotUrl: form.hubspotUrl.trim() || undefined,
        recipientTo: form.recipientTo.trim(),
        recipientCc: form.recipientCc.trim() || undefined,
        subject: form.subject.trim(),
        templateCode: form.templateCode.trim(),
        body: form.body.trim() || undefined,
        attachmentUrls: attachmentUrls.length ? attachmentUrls : undefined,
      };
      const res = await apiFetch(`/api/activations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        setError(Array.isArray(data.message) ? data.message.join(', ') : data.message ?? 'Error al guardar');
        return;
      }
      router.push(`/activations/${id}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  if (fetchLoading) return <p style={{ padding: '2rem' }}>Cargando…</p>;
  if (loadError) return <p style={{ padding: '2rem', color: '#b00' }}>{loadError}</p>;

  return (
    <main style={styles.main}>
      <Link href={`/activations/${id}`} style={styles.back}>← Volver al detalle</Link>
      <h1 style={styles.h1}>Editar activación</h1>
      <form onSubmit={handleSubmit}>
        <div style={styles.formGroup}>
          <label style={styles.label} htmlFor="projectName">Nombre del proyecto *</label>
          <input id="projectName" name="projectName" type="text" value={form.projectName} onChange={handleChange} required style={styles.input} />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label} htmlFor="offerCode">Código de oferta *</label>
          <input id="offerCode" name="offerCode" type="text" value={form.offerCode} onChange={handleChange} required style={styles.input} />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label} htmlFor="hubspotUrl">URL HubSpot</label>
          <input id="hubspotUrl" name="hubspotUrl" type="url" value={form.hubspotUrl} onChange={handleChange} style={styles.input} />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label} htmlFor="recipientTo">Destinatario (To) *</label>
          <input id="recipientTo" name="recipientTo" type="text" value={form.recipientTo} onChange={handleChange} required style={styles.input} />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label} htmlFor="recipientCc">Destinatario (CC)</label>
          <input id="recipientCc" name="recipientCc" type="text" value={form.recipientCc} onChange={handleChange} style={styles.input} />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label} htmlFor="subject">Asunto *</label>
          <input id="subject" name="subject" type="text" value={form.subject} onChange={handleChange} required style={styles.input} />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label} htmlFor="templateCode">Código de plantilla *</label>
          <input id="templateCode" name="templateCode" type="text" value={form.templateCode} onChange={handleChange} required style={styles.input} />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label} htmlFor="body">Cuerpo del correo</label>
          <textarea id="body" name="body" value={form.body} onChange={handleChange} style={{ ...styles.textarea, minHeight: 120 }} />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label} htmlFor="attachmentUrlsText">URLs de adjuntos</label>
          <textarea id="attachmentUrlsText" name="attachmentUrlsText" value={form.attachmentUrlsText} onChange={handleChange} style={{ ...styles.textarea, minHeight: 60 }} placeholder="Una URL por línea o separadas por comas" />
        </div>
        {error && <p style={styles.error}>{error}</p>}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button type="submit" disabled={saving} style={styles.button}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
          <Link href={`/activations/${id}`} style={styles.buttonSecondary}>Cancelar</Link>
        </div>
      </form>
    </main>
  );
}
