'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { RichTextEditor } from '@/components/RichTextEditor/RichTextEditor';
import styles from '../configuration.module.css';

export default function EmailSignaturePage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [systemContent, setSystemContent] = useState('');
  const [systemError, setSystemError] = useState('');
  const [systemSaving, setSystemSaving] = useState(false);

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then((r) => {
        if (r.status === 401) {
          window.location.href = '/login';
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then(async (user) => {
        const admin = user?.role === 'ADMIN';
        setIsAdmin(!!admin);
        const res = await apiFetch('/api/email-signature');
        if (res.status === 401) {
          window.location.href = '/login';
          return;
        }
        const data = res.ok ? await res.json() : {};
        if (typeof data?.content === 'string') setContent(data.content);
        if (admin) {
          const sr = await apiFetch('/api/email-signature?scope=system');
          if (sr.ok) {
            const sd = await sr.json();
            if (typeof sd?.content === 'string') setSystemContent(sd.content);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
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

  const handleSystemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSystemError('');
    setSystemSaving(true);
    try {
      const res = await apiFetch('/api/email-signature?scope=system', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: systemContent }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        setSystemError(
          Array.isArray(data.message) ? data.message.join(', ') : data.message ?? 'Error al guardar',
        );
        return;
      }
      if (typeof data?.content === 'string') setSystemContent(data.content);
    } finally {
      setSystemSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className={styles.page}>
      <Link href="/launcher/activations/configuration" className={styles.back}>← Configuración</Link>
      <h1 className={styles.h1}>Firma</h1>
      <p className={styles.sectionDesc}>
        {isAdmin
          ? 'Tu firma personal se envía con tus activaciones. Más abajo puedes editar la plantilla HTML que reciben los usuarios nuevos al crear su firma por primera vez.'
          : 'Firma HTML que se envía en el webhook a Make junto con el cuerpo del correo. Una firma por usuario.'}
      </p>
      {error && <p className={styles.error}>{error}</p>}

      <section className={styles.templateCard} aria-labelledby="signature-form-heading">
        <h2 id="signature-form-heading" className={styles.templateCardTitle}>
          {isAdmin ? 'Tu firma (activaciones)' : 'Firma de correo'}
        </h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 'var(--fiori-space-4)' }}>
            <label className={styles.label} htmlFor="signature-content">Contenido (editor visual)</label>
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

          <div
            className={styles.signaturePreviewSection}
            role="region"
            aria-label="Vista previa de la firma"
          >
            <span className={styles.signaturePreviewLabel}>Vista previa (como en el correo)</span>
            <p className={styles.signaturePreviewHint}>
              Refleja el HTML guardado: mismo aspecto que tendrá en el mensaje (tablas, imágenes, enlaces).
            </p>
            <div className={styles.signaturePreviewBox} aria-live="polite">
              {content.trim() ? (
                <div dangerouslySetInnerHTML={{ __html: content }} />
              ) : (
                <p className={styles.signaturePreviewEmpty}>Sin contenido aún</p>
              )}
            </div>
          </div>

          <details className={styles.htmlSourceDetails}>
            <summary className={styles.htmlSourceSummary}>HTML de la firma (avanzado)</summary>
            <p className={styles.htmlSourceHelp}>
              Mismo HTML que se guarda y envía. Úsalo si necesitas pegar HTML muy complejo desde Outlook que el editor no interprete bien; el editor de arriba admite tablas, texto, enlaces e imágenes.
            </p>
            <textarea
              id="signature-html-source"
              className={styles.htmlSourceTextarea}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
              aria-label="HTML de la firma"
            />
          </details>
          <button type="submit" disabled={saving} className={styles.btnPrimary}>
            {saving ? 'Guardando…' : 'Guardar firma'}
          </button>
        </form>
      </section>

      {isAdmin && (
        <section className={styles.templateCard} aria-labelledby="signature-system-heading" style={{ marginTop: 'var(--fiori-space-6)' }}>
          <h2 id="signature-system-heading" className={styles.templateCardTitle}>
            Plantilla inicial (nuevos usuarios)
          </h2>
          <p className={styles.sectionDesc} style={{ marginTop: 0 }}>
            Contenido por defecto al ejecutar el arranque de configuración para cuentas que aún no tienen firma propia.
          </p>
          {systemError && <p className={styles.error}>{systemError}</p>}
          <form onSubmit={handleSystemSubmit}>
            <div style={{ marginBottom: 'var(--fiori-space-4)' }}>
              <label className={styles.label} htmlFor="signature-system-content">Contenido (editor visual)</label>
              <RichTextEditor
                id="signature-system-content"
                value={systemContent}
                onChange={setSystemContent}
                placeholder="Plantilla base para nuevos usuarios…"
                minHeight={180}
                aria-label="Plantilla de firma de sistema"
                allowImages
              />
            </div>
            <button type="submit" disabled={systemSaving} className={styles.btnSecondary}>
              {systemSaving ? 'Guardando…' : 'Guardar plantilla de sistema'}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
