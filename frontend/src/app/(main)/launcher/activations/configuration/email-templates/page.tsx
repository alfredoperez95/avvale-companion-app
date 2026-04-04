'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { RichTextEditor } from '@/components/RichTextEditor/RichTextEditor';
import { TEMPLATE_SHORTCODES } from '@/lib/replace-template-variables';
import { LoadingScreen } from '@/components/LoadingScreen/LoadingScreen';
import { PageBreadcrumb, PageBackLink, PageHero } from '@/components/page-hero';
import styles from '../configuration.module.css';

type EmailTemplateItem = { id: string; name: string; content: string; createdAt: string };

export default function AdminEmailTemplatesPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplateItem[]>([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formContent, setFormContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const loadTemplates = async (admin: boolean) => {
    try {
      const url = admin ? '/api/email-templates?scope=system' : '/api/email-templates';
      const res = await apiFetch(url);
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = Array.isArray(err.message) ? err.message.join(', ') : err.message;
        setError(msg ?? `Error al cargar plantillas (${res.status})`);
        setTemplates([]);
        return;
      }
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : []);
      setError('');
    } catch {
      setError('Error de conexión al cargar plantillas');
      setTemplates([]);
    }
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
        const admin = user?.role === 'ADMIN';
        setIsAdmin(!!admin);
        return loadTemplates(!!admin);
      })
      .finally(() => setLoading(false))
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
        await loadTemplates(isAdmin);
      } else {
        const createUrl = isAdmin ? '/api/email-templates?system=true' : '/api/email-templates';
        const res = await apiFetch(createUrl, {
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
        await loadTemplates(isAdmin);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreFromSystem = async () => {
    setError('');
    setRestoring(true);
    try {
      const res = await apiFetch('/api/email-templates/restore-from-system', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        setError(
          Array.isArray(data.message) ? data.message.join(', ') : data.message ?? 'Error al restaurar',
        );
        return;
      }
      setConfirmRestoreOpen(false);
      closeForm();
      // El endpoint devuelve siempre las plantillas personales; la vista de administrador sigue listando el catálogo sistema.
      await loadTemplates(isAdmin);
    } finally {
      setRestoring(false);
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
      await loadTemplates(isAdmin);
    } catch {
      setError('Error de conexión');
    }
  };

  if (loading) {
    return <LoadingScreen message="Cargando plantillas…" fullPage={false} />;
  }

  return (
    <div className={styles.page}>
      <PageBreadcrumb>
        <PageBackLink href="/launcher/activations/configuration">← Configuración</PageBackLink>
      </PageBreadcrumb>
      <PageHero
        title="Plantillas Email"
        subtitle={
          isAdmin
            ? 'Estás editando las plantillas de sistema: se copian a cada usuario la primera vez que entra (bootstrap). En las activaciones cada persona usa su copia personal.'
            : 'Crea y edita plantillas para el cuerpo del correo con el editor de texto enriquecido. Podrás elegirlas al crear o editar una activación.'
        }
      />
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

      <section
        className={styles.templateCard}
        aria-labelledby="restore-templates-heading"
        style={{ marginTop: 'var(--fiori-space-6)' }}
      >
        <h2 id="restore-templates-heading" className={styles.templateCardTitle}>
          {isAdmin ? 'Restaurar copias personales' : 'Restaurar desde el catálogo de sistema'}
        </h2>
        <p className={styles.sectionDesc} style={{ marginTop: 0 }}>
          {isAdmin
            ? 'El botón aplica a tus copias para activaciones (no modifica el catálogo de sistema de esta pantalla).'
            : 'Puedes volver a las plantillas predefinidas del administrador en cualquier momento; se sustituirán tus plantillas actuales por copias del catálogo de sistema.'}
        </p>
        <button
          type="button"
          className={styles.btnPrimary}
          disabled={restoring}
          onClick={() => setConfirmRestoreOpen(true)}
        >
          {isAdmin ? 'Restaurar mis plantillas personales' : 'Restaurar plantillas predefinidas'}
        </button>
      </section>

      <ConfirmDialog
        open={confirmDeleteId != null}
        title="Eliminar plantilla"
        message="¿Eliminar esta plantilla? No se desharán los correos ya enviados que la usaron."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
      <ConfirmDialog
        open={confirmRestoreOpen}
        title={isAdmin ? 'Restaurar plantillas personales' : 'Restaurar plantillas predefinidas'}
        message={
          isAdmin
            ? 'Se eliminarán tus plantillas personales (para activaciones) y se crearán de nuevo copiando el catálogo de sistema actual. El listado de arriba (plantillas de sistema) no cambia.'
            : 'Se eliminarán tus plantillas actuales y se volverán a crear copiando las plantillas predefinidas del administrador. Esta acción no se puede deshacer.'
        }
        confirmLabel="Restaurar"
        variant="danger"
        onConfirm={() => void handleRestoreFromSystem()}
        onCancel={() => setConfirmRestoreOpen(false)}
      />
    </div>
  );
}
