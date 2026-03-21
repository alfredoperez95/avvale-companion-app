'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { RichTextEditor } from '@/components/RichTextEditor/RichTextEditor';
import styles from '../configuration.module.css';

export default function EmailSignaturePage() {
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then((r) => {
        if (r.status === 401) {
          window.location.href = '/login';
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((user) => {
        if (user?.role !== 'ADMIN') {
          setForbidden(true);
          setLoading(false);
          return;
        }
        apiFetch('/api/email-signature')
          .then((res) => {
            if (res.status === 401) {
              window.location.href = '/login';
              return;
            }
            return res.ok ? res.json() : {};
          })
          .then((data: unknown) => {
            const d = data as { content?: string };
            if (typeof d?.content === 'string') setContent(d.content);
          })
          .finally(() => setLoading(false));
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await apiFetch('/api/email-signature', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        setError(Array.isArray(data.message) ? data.message.join(', ') : data.message ?? 'Error al guardar');
        return;
      }
      if (typeof data?.content === 'string') setContent(data.content);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  if (forbidden) {
    return (
      <div className={styles.page}>
        <Link href="/launcher/activations/configuration" className={styles.back}>← Configuración</Link>
        <p className={styles.forbidden}>No tienes permisos para acceder a esta sección.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link href="/launcher/activations/configuration" className={styles.back}>← Configuración</Link>
      <h1 className={styles.h1}>Firma</h1>
      <p className={styles.sectionDesc}>
        Firma HTML que se envía en el webhook a Make junto con el cuerpo del correo. Puedes concatenarla al mensaje en el escenario (por ejemplo después de <code>body</code>).
      </p>
      {error && <p className={styles.error}>{error}</p>}

      <section className={styles.templateCard} aria-labelledby="signature-form-heading">
        <h2 id="signature-form-heading" className={styles.templateCardTitle}>
          Firma de correo
        </h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 'var(--fiori-space-4)' }}>
            <label className={styles.label} htmlFor="signature-content">Contenido (editor)</label>
            <RichTextEditor
              id="signature-content"
              value={content}
              onChange={setContent}
              placeholder="Nombre, cargo, teléfono, enlaces…"
              minHeight={200}
              aria-label="Contenido de la firma"
              allowImages
            />
          </div>
          <button type="submit" disabled={saving} className={styles.btnPrimary}>
            {saving ? 'Guardando…' : 'Guardar firma'}
          </button>
        </form>
      </section>
    </div>
  );
}
