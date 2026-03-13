'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import styles from './form.module.css';

type AreaOption = { id: string; name: string };

export default function NewActivationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [selectedAreas, setSelectedAreas] = useState<AreaOption[]>([]);
  const [form, setForm] = useState({
    projectName: '',
    client: '',
    offerCode: '',
    hubspotUrl: '',
    body: '',
    attachmentUrlsText: '',
  });

  const computedSubject = `Activación AEP - ${(form.client || '').trim().toUpperCase()} - ${(form.projectName || '').trim()}`;

  useEffect(() => {
    apiFetch('/api/areas')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setAreas(Array.isArray(data) ? data : []))
      .catch(() => setAreas([]));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const addArea = (area: AreaOption) => {
    if (selectedAreas.some((a) => a.id === area.id)) return;
    setSelectedAreas((prev) => [...prev, area]);
  };

  const removeArea = (id: string) => {
    setSelectedAreas((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (selectedAreas.length === 0) {
      setError('Selecciona al menos un área involucrada.');
      return;
    }
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
        areaIds: selectedAreas.map((a) => a.id),
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

  const availableToSelect = areas.filter((a) => !selectedAreas.some((s) => s.id === a.id));

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
          <label className={styles.label}>Áreas involucradas en la activación *</label>
          <div className={styles.areaTagsRow}>
            <select
              className={styles.areaSelect}
              value=""
              onChange={(e) => {
                const id = e.target.value;
                if (id) {
                  const area = areas.find((a) => a.id === id);
                  if (area) addArea(area);
                  e.target.value = '';
                }
              }}
              aria-label="Añadir área"
            >
              <option value="">Seleccionar área…</option>
              {availableToSelect.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            {selectedAreas.map((a) => (
              <span key={a.id} className={styles.areaTag}>
                {a.name}
                <button type="button" className={styles.areaTagRemove} onClick={() => removeArea(a.id)} aria-label={`Quitar ${a.name}`}>×</button>
              </span>
            ))}
          </div>
          {selectedAreas.length === 0 && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--fiori-text-secondary)', marginTop: 'var(--fiori-space-1)' }}>
              Añade al menos un área. Los destinatarios se asignarán según los contactos configurados en cada área.
            </p>
          )}
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="subject">Asunto</label>
          <input id="subject" type="text" value={computedSubject} readOnly className={styles.inputReadOnly} aria-readonly="true" />
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
          <button type="submit" disabled={loading || selectedAreas.length === 0} className={styles.btnPrimary}>
            {loading ? 'Guardando…' : 'Guardar borrador'}
          </button>
          <Link href="/activations" className={styles.btnSecondary}>Cancelar</Link>
        </div>
      </form>
    </main>
  );
}
