'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import styles from './form.module.css';

export default function NewActivationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    projectName: '',
    client: '',
    offerCode: '',
    hubspotUrl: '',
    recipientTo: '',
    recipientCc: '',
    templateCode: '',
    body: '',
    attachmentUrlsText: '',
  });

  const computedSubject = `Activación AEP - "${(form.client || '').trim().toUpperCase()}" - "${(form.projectName || '').trim()}"`;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const attachmentUrls = form.attachmentUrlsText
        .split(/[\n,]/)
        .map((u) => u.trim())
        .filter(Boolean);
      const body = {
        projectName: form.projectName.trim(),
        client: form.client.trim() || undefined,
        offerCode: form.offerCode.trim(),
        hubspotUrl: form.hubspotUrl.trim() || undefined,
        recipientTo: form.recipientTo.trim(),
        recipientCc: form.recipientCc.trim() || undefined,
        templateCode: form.templateCode.trim(),
        body: form.body.trim() || undefined,
        attachmentUrls: attachmentUrls.length ? attachmentUrls : undefined,
      };
      const res = await apiFetch('/api/activations', {
        method: 'POST',
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
      router.push('/activations');
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <Link href="/dashboard" className={styles.back}>← Inicio</Link>
      <h1 className={styles.h1}>Nueva activación</h1>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="projectName">Nombre del proyecto *</label>
          <input id="projectName" name="projectName" type="text" value={form.projectName} onChange={handleChange} required className={styles.input} placeholder="Ej. Transformación digital" />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="client">Cliente</label>
          <input id="client" name="client" type="text" value={form.client} onChange={handleChange} className={styles.input} placeholder="Nombre del cliente" />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="offerCode">Código de oferta *</label>
          <input id="offerCode" name="offerCode" type="text" value={form.offerCode} onChange={handleChange} required className={styles.input} placeholder="Ej. OF-2026-01" />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="hubspotUrl">URL HubSpot</label>
          <input id="hubspotUrl" name="hubspotUrl" type="url" value={form.hubspotUrl} onChange={handleChange} className={styles.input} placeholder="https://..." />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="recipientTo">Destinatario (To) *</label>
          <input id="recipientTo" name="recipientTo" type="text" value={form.recipientTo} onChange={handleChange} required className={styles.input} placeholder="email@ejemplo.com" />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="recipientCc">Destinatario (CC)</label>
          <input id="recipientCc" name="recipientCc" type="text" value={form.recipientCc} onChange={handleChange} className={styles.input} placeholder="opcional" />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="subject">Asunto</label>
          <input id="subject" type="text" value={computedSubject} readOnly className={styles.inputReadOnly} aria-readonly="true" />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="templateCode">Código de plantilla *</label>
          <input id="templateCode" name="templateCode" type="text" value={form.templateCode} onChange={handleChange} required className={styles.input} placeholder="Ej. ACTIVACION_ESTANDAR" />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="body">Cuerpo del correo</label>
          <textarea id="body" name="body" value={form.body} onChange={handleChange} className={styles.textarea} style={{ minHeight: 120 }} placeholder="Contenido del email (opcional)" />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="attachmentUrlsText">URLs de adjuntos</label>
          <textarea id="attachmentUrlsText" name="attachmentUrlsText" value={form.attachmentUrlsText} onChange={handleChange} className={styles.textarea} style={{ minHeight: 60 }} placeholder="Una URL por línea o separadas por comas" />
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <button type="submit" disabled={loading} className={styles.btnPrimary}>
            {loading ? 'Guardando…' : 'Guardar borrador'}
          </button>
          <Link href="/activations" className={styles.btnSecondary}>Cancelar</Link>
        </div>
      </form>
    </main>
  );
}
