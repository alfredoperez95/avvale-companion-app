'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { RichTextEditor } from '@/components/RichTextEditor/RichTextEditor';
import { PageBreadcrumb, PageBackLink, PageHero } from '@/components/page-hero';
import styles from '../configuration.module.css';

export default function EmailSignaturePage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [systemError, setSystemError] = useState('');
  const [applyInitialSaving, setApplyInitialSaving] = useState(false);
  const [resetFromInitialSaving, setResetFromInitialSaving] = useState(false);

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

  const handleApplyPersonalAsInitialTemplate = async () => {
    setSystemError('');
    setApplyInitialSaving(true);
    try {
      const res = await apiFetch('/api/email-signature?scope=system', {
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
        setSystemError(
          Array.isArray(data.message) ? data.message.join(', ') : data.message ?? 'Error al guardar',
        );
      }
    } finally {
      setApplyInitialSaving(false);
    }
  };

  const handleResetSignatureFromInitialTemplate = async () => {
    setSystemError('');
    setResetFromInitialSaving(true);
    try {
      const res = await apiFetch('/api/email-signature?scope=system');
      const data = res.ok ? await res.json().catch(() => ({})) : {};
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        setSystemError(
          Array.isArray(data.message) ? data.message.join(', ') : data.message ?? 'Error al cargar',
        );
        return;
      }
      if (typeof data?.content === 'string') setContent(data.content);
    } finally {
      setResetFromInitialSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <p className={styles.loadingState}>Cargando firma…</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <PageBreadcrumb>
        <PageBackLink href="/launcher/activations/configuration">← Configuración</PageBackLink>
      </PageBreadcrumb>
      <PageHero
        title="Firma"
        subtitle={
          isAdmin
            ? 'Tu firma personal se envía con tus activaciones. Más abajo puedes editar la plantilla HTML que reciben los usuarios nuevos al crear su firma por primera vez.'
            : 'Firma HTML que se envía en el webhook a Make junto con el cuerpo del correo. Una firma por usuario.'
        }
      />
      {error ? <p className={`${styles.error} ${styles.errorBanner}`}>{error}</p> : null}

      <section className={styles.templateCard} aria-labelledby="signature-form-heading">
        <h2 id="signature-form-heading" className={styles.templateCardTitle}>
          {isAdmin ? 'Tu firma (activaciones)' : 'Firma de correo'}
        </h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formFieldStack}>
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
        <section className={styles.templateCard} aria-labelledby="signature-system-heading">
          <h2 id="signature-system-heading" className={styles.templateCardTitle}>
            Restablecer firma predeterminada
          </h2>
          <p className={styles.sectionDesc}>
            Puedes utilizar este contenido para restablecer la firma predeterminada si la cuenta no tiene una firma propia.
          </p>
          {systemError ? <p className={`${styles.error} ${styles.errorBanner}`}>{systemError}</p> : null}
          <div className={styles.adminActionsRow}>
            <button
              type="button"
              disabled={applyInitialSaving}
              className={styles.btnPrimary}
              onClick={handleApplyPersonalAsInitialTemplate}
            >
              {applyInitialSaving ? 'Aplicando…' : 'Aplicar'}
            </button>
            <button
              type="button"
              disabled={resetFromInitialSaving}
              className={styles.btnSecondary}
              onClick={handleResetSignatureFromInitialTemplate}
            >
              {resetFromInitialSaving ? 'Cargando…' : 'Restablecer firma'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
