'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { RichTextEditor } from '@/components/RichTextEditor/RichTextEditor';
import { TEMPLATE_SHORTCODES } from '@/lib/replace-template-variables';
import styles from '../configuration.module.css';

type EmailTemplateItem = { id: string; name: string; content: string; createdAt: string };

export default function AdminEmailTemplatesPage() {
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplateItem[]>([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formContent, setFormContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadTemplates = async () => {
    const res = await apiFetch('/api/email-templates');
    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    setTemplates(Array.isArray(data) ? data : []);
  };

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
        loadTemplates().finally(() => setLoading(false));
      })
      .catch(() => setLoading(false));
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setFormName('');
    setFormContent('');
    setShowForm(true);
    setError('');
  };

  const openEdit = (t: EmailTemplateItem) => {
    setEditingId(t.id);
    setFormName(t.name);
    setFormContent(t.content ?? '');
    setShowForm(true);
    setError('');
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormName('');
    setFormContent('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = formName.trim();
    if (!name) return;
    setError('');
    setSaving(true);
    try {
      if (editingId) {
        const res = await apiFetch(`/api/email-templates/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, content: formContent }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.message ?? 'Error al actualizar');
          return;
        }
        closeForm();
        await loadTemplates();
      } else {
        const res = await apiFetch('/api/email-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, content: formContent }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.message ?? 'Error al crear');
          return;
        }
        closeForm();
        await loadTemplates();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError('');
    try {
      const res = await apiFetch(`/api/email-templates/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? 'Error al eliminar');
        return;
      }
      setConfirmDeleteId(null);
      if (editingId === id) closeForm();
      await loadTemplates();
    } catch {
      setError('Error de conexión');
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <p className={styles.forbidden}>Cargando…</p>
      </div>
    );
  }

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
      <h1 className={styles.h1}>Plantillas Email</h1>
      <p className={styles.sectionDesc}>
        Crea y edita plantillas para el cuerpo del correo con el editor de texto enriquecido. Podrás elegirlas al crear o editar una activación.
      </p>
      {error && <p className={styles.error}>{error}</p>}

      <section className={styles.templateCard} aria-labelledby="create-template-heading">
        <h2 id="create-template-heading" className={styles.templateCardTitle}>
          {showForm ? (editingId ? 'Editar plantilla' : 'Nueva plantilla') : 'Crear plantilla'}
        </h2>
        {showForm ? (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 'var(--fiori-space-4)' }}>
              <label className={styles.label} htmlFor="template-name">Nombre</label>
              <input
                id="template-name"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className={styles.contactsInput}
                placeholder="Ej: Activación estándar"
                required
                style={{ display: 'block', marginBottom: 'var(--fiori-space-3)', minWidth: '20rem' }}
              />
            </div>
            <div style={{ marginBottom: 'var(--fiori-space-4)' }}>
              <label className={styles.label} htmlFor="template-content">Contenido (editor)</label>
              <RichTextEditor
                id="template-content"
                value={formContent}
                onChange={setFormContent}
                placeholder="Escribe el contenido de la plantilla…"
                minHeight={200}
                aria-label="Contenido de la plantilla"
                insertableVariables={TEMPLATE_SHORTCODES}
              />
              <p className={styles.templateVariablesHelp}>
                Variables disponibles (usa el desplegable del editor o escribe a mano):{' '}
                {TEMPLATE_SHORTCODES.map((s) => s.value).join(', ')}. Se sustituirán por los datos del formulario al elegir la plantilla en una activación.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 'var(--fiori-space-2)', flexWrap: 'wrap' }}>
              <button type="submit" disabled={saving} className={styles.btnPrimary}>
                {saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear plantilla'}
              </button>
              <button type="button" className={styles.btnSecondary} onClick={closeForm} disabled={saving}>
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <p className={styles.sectionDesc} style={{ marginBottom: 'var(--fiori-space-3)' }}>
            Usa el botón para abrir el editor y crear una nueva plantilla.
          </p>
        )}
        {!showForm && (
          <button type="button" className={styles.btnPrimary} onClick={openCreate}>
            Crear plantilla
          </button>
        )}
      </section>

      <h2 className={styles.areasListTitle}>Plantillas disponibles</h2>
      {templates.length === 0 ? (
        <p className={styles.sectionDesc}>
          No hay plantillas. Crea una con el botón &quot;Crear plantilla&quot;.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {templates.map((t) => (
            <li
              key={t.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--fiori-space-2) var(--fiori-space-3)',
                border: '1px solid var(--fiori-border-light)',
                borderRadius: '0.375rem',
                marginBottom: 'var(--fiori-space-2)',
                background: 'var(--fiori-surface)',
              }}
            >
              <span style={{ fontWeight: 500, color: 'var(--fiori-text)' }}>{t.name}</span>
              <div style={{ display: 'flex', gap: 'var(--fiori-space-2)' }}>
                <button type="button" className={styles.btnSmall} onClick={() => openEdit(t)}>
                  Editar
                </button>
                <button
                  type="button"
                  className={`${styles.btnSmall} ${styles.btnSmallDanger}`}
                  onClick={() => setConfirmDeleteId(t.id)}
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirmDeleteId != null}
        title="Eliminar plantilla"
        message="¿Eliminar esta plantilla? No se desharán los correos ya enviados que la usaron."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
