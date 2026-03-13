'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import styles from './admin.module.css';

type SubAreaContact = { id: string; name: string; email: string };
type SubArea = { id: string; name: string; contacts: SubAreaContact[] };
type Area = {
  id: string;
  name: string;
  directorName: string | null;
  directorEmail: string | null;
  subAreas: SubArea[];
};

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [areas, setAreas] = useState<Area[]>([]);
  const [error, setError] = useState('');
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaDirectorName, setNewAreaDirectorName] = useState('');
  const [newAreaDirectorEmail, setNewAreaDirectorEmail] = useState('');
  const [savingAreaId, setSavingAreaId] = useState<string | null>(null);
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [editingAreaName, setEditingAreaName] = useState('');
  const [editingDirectorAreaId, setEditingDirectorAreaId] = useState<string | null>(null);
  const [editDirectorName, setEditDirectorName] = useState('');
  const [editDirectorEmail, setEditDirectorEmail] = useState('');
  const [addingSubAreaAreaId, setAddingSubAreaAreaId] = useState<string | null>(null);
  const [newSubAreaName, setNewSubAreaName] = useState('');
  const [editingSubAreaId, setEditingSubAreaId] = useState<string | null>(null);
  const [editSubAreaName, setEditSubAreaName] = useState('');
  const [addingContactSubAreaId, setAddingContactSubAreaId] = useState<string | null>(null);
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editContactName, setEditContactName] = useState('');
  const [editContactEmail, setEditContactEmail] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ area?: string; subarea?: string; contact?: string } | null>(null);

  const loadAreas = async () => {
    const res = await apiFetch('/api/areas?admin=true');
    if (res.status === 403 || res.status === 401) {
      setForbidden(true);
      if (res.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    setAreas(Array.isArray(data) ? data : []);
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
        loadAreas().finally(() => setLoading(false));
      })
      .catch(() => setLoading(false));
  }, []);

  const handleCreateArea = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const name = newAreaName.trim();
    if (!name) return;
    setSavingAreaId('new');
    try {
      const res = await apiFetch('/api/areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          directorName: newAreaDirectorName.trim() || undefined,
          directorEmail: newAreaDirectorEmail.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? 'Error al crear el área');
        return;
      }
      setNewAreaName('');
      setNewAreaDirectorName('');
      setNewAreaDirectorEmail('');
      await loadAreas();
    } finally {
      setSavingAreaId(null);
    }
  };

  const handleUpdateAreaName = async (areaId: string) => {
    const name = editingAreaName.trim();
    if (!name) return;
    setSavingAreaId(areaId);
    setError('');
    try {
      const res = await apiFetch(`/api/areas/${areaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? 'Error al actualizar');
        return;
      }
      setEditingAreaId(null);
      await loadAreas();
    } finally {
      setSavingAreaId(null);
    }
  };

  const handleUpdateDirector = async (areaId: string) => {
    setSavingAreaId(areaId);
    setError('');
    try {
      const res = await apiFetch(`/api/areas/${areaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directorName: editDirectorName.trim() || null,
          directorEmail: editDirectorEmail.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? 'Error al actualizar director');
        return;
      }
      setEditingDirectorAreaId(null);
      await loadAreas();
    } finally {
      setSavingAreaId(null);
    }
  };

  const handleDeleteArea = async (areaId: string) => {
    setError('');
    try {
      const res = await apiFetch(`/api/areas/${areaId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? 'Error al eliminar');
        return;
      }
      setConfirmDelete(null);
      await loadAreas();
    } catch {
      setError('Error de conexión');
    }
  };

  const handleAddSubArea = async (areaId: string, e: React.FormEvent) => {
    e.preventDefault();
    const name = newSubAreaName.trim();
    if (!name) return;
    setError('');
    setSavingAreaId(areaId);
    try {
      const res = await apiFetch(`/api/areas/${areaId}/subareas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? 'Error al crear subárea');
        return;
      }
      setAddingSubAreaAreaId(null);
      setNewSubAreaName('');
      await loadAreas();
    } finally {
      setSavingAreaId(null);
    }
  };

  const handleUpdateSubAreaName = async (subAreaId: string) => {
    const name = editSubAreaName.trim();
    if (!name) return;
    setError('');
    setSavingAreaId(subAreaId);
    try {
      const res = await apiFetch(`/api/areas/subareas/${subAreaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? 'Error al actualizar subárea');
        return;
      }
      setEditingSubAreaId(null);
      await loadAreas();
    } finally {
      setSavingAreaId(null);
    }
  };

  const handleDeleteSubArea = async (subAreaId: string) => {
    setError('');
    try {
      const res = await apiFetch(`/api/areas/subareas/${subAreaId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? 'Error al eliminar subárea');
        return;
      }
      setConfirmDelete(null);
      await loadAreas();
    } catch {
      setError('Error de conexión');
    }
  };

  const handleAddContact = async (subAreaId: string, e: React.FormEvent) => {
    e.preventDefault();
    const name = newContactName.trim();
    const email = newContactEmail.trim();
    if (!name || !email) return;
    setError('');
    setSavingAreaId(subAreaId);
    try {
      const res = await apiFetch(`/api/areas/subareas/${subAreaId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? 'Error al añadir contacto');
        return;
      }
      setAddingContactSubAreaId(null);
      setNewContactName('');
      setNewContactEmail('');
      await loadAreas();
    } finally {
      setSavingAreaId(null);
    }
  };

  const handleUpdateContact = async (contactId: string) => {
    const name = editContactName.trim();
    const email = editContactEmail.trim();
    if (!name || !email) return;
    setError('');
    setSavingAreaId(contactId);
    try {
      const res = await apiFetch(`/api/areas/subareas/contacts/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? 'Error al actualizar contacto');
        return;
      }
      setEditingContactId(null);
      await loadAreas();
    } finally {
      setSavingAreaId(null);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    setError('');
    try {
      const res = await apiFetch(`/api/areas/subareas/contacts/${contactId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? 'Error al eliminar');
        return;
      }
      setConfirmDelete(null);
      await loadAreas();
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
        <Link href="/dashboard" className={styles.back}>← Inicio</Link>
        <p className={styles.forbidden}>No tienes permisos para acceder a esta sección.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link href="/dashboard" className={styles.back}>← Inicio</Link>
      <h1 className={styles.h1}>Configuración: Áreas, director y subáreas</h1>
      {error && <p className={styles.error}>{error}</p>}

      <form onSubmit={handleCreateArea} className={styles.addAreaRow}>
        <input
          type="text"
          className={styles.addAreaRowInput}
          value={newAreaName}
          onChange={(e) => setNewAreaName(e.target.value)}
          placeholder="Nombre del área"
          aria-label="Nombre del área"
        />
        <input
          type="text"
          className={styles.addAreaRowInput}
          value={newAreaDirectorName}
          onChange={(e) => setNewAreaDirectorName(e.target.value)}
          placeholder="Director (nombre)"
          aria-label="Director nombre"
        />
        <input
          type="email"
          className={styles.addAreaRowInput}
          value={newAreaDirectorEmail}
          onChange={(e) => setNewAreaDirectorEmail(e.target.value)}
          placeholder="Director (email)"
          aria-label="Director email"
        />
        <button type="submit" disabled={savingAreaId === 'new'} className={styles.btnPrimary}>
          {savingAreaId === 'new' ? 'Guardando…' : 'Nueva área'}
        </button>
      </form>

      {areas.map((area) => (
        <div key={area.id} className={styles.areaCard}>
          <div className={styles.areaHeader}>
            {editingAreaId === area.id ? (
              <>
                <input
                  type="text"
                  className={styles.areaNameInput}
                  value={editingAreaName}
                  onChange={(e) => setEditingAreaName(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  className={styles.btnSmall}
                  onClick={() => handleUpdateAreaName(area.id)}
                  disabled={savingAreaId === area.id}
                >
                  Guardar
                </button>
                <button
                  type="button"
                  className={styles.btnSmall}
                  onClick={() => { setEditingAreaId(null); setEditingAreaName(''); }}
                >
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <span className={styles.areaName}>{area.name}</span>
                <button
                  type="button"
                  className={styles.btnSmall}
                  onClick={() => { setEditingAreaId(area.id); setEditingAreaName(area.name); }}
                >
                  Editar nombre
                </button>
                <button
                  type="button"
                  className={`${styles.btnSmall} ${styles.btnSmallDanger}`}
                  onClick={() => setConfirmDelete({ area: area.id })}
                >
                  Eliminar área
                </button>
              </>
            )}
          </div>

          <div className={styles.directorBlock}>
            <label>Director del área</label>
            {editingDirectorAreaId === area.id ? (
              <div className={styles.addContactRow}>
                <input
                  type="text"
                  value={editDirectorName}
                  onChange={(e) => setEditDirectorName(e.target.value)}
                  placeholder="Nombre director"
                />
                <input
                  type="email"
                  value={editDirectorEmail}
                  onChange={(e) => setEditDirectorEmail(e.target.value)}
                  placeholder="Email director"
                />
                <button
                  type="button"
                  className={styles.btnSmall}
                  onClick={() => handleUpdateDirector(area.id)}
                  disabled={savingAreaId === area.id}
                >
                  Guardar
                </button>
                <button
                  type="button"
                  className={styles.btnSmall}
                  onClick={() => setEditingDirectorAreaId(null)}
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <div className={styles.contactRow}>
                <span className={styles.contactText}>
                  {area.directorName || area.directorEmail
                    ? `${area.directorName ?? ''} ${area.directorEmail ?? ''}`.trim()
                    : 'Sin director'}
                </span>
                <button
                  type="button"
                  className={styles.btnSmall}
                  onClick={() => {
                    setEditingDirectorAreaId(area.id);
                    setEditDirectorName(area.directorName ?? '');
                    setEditDirectorEmail(area.directorEmail ?? '');
                  }}
                >
                  {area.directorName || area.directorEmail ? 'Editar' : 'Añadir director'}
                </button>
              </div>
            )}
          </div>

          <div className={styles.subareaSection}>
            <strong>Subáreas</strong>
            {(area.subAreas ?? []).map((sub) => (
              <div key={sub.id} className={styles.subareaBlock}>
                <div className={styles.subareaHeader}>
                  {editingSubAreaId === sub.id ? (
                    <>
                      <input
                        type="text"
                        className={styles.areaNameInput}
                        value={editSubAreaName}
                        onChange={(e) => setEditSubAreaName(e.target.value)}
                        size={20}
                      />
                      <button
                        type="button"
                        className={styles.btnSmall}
                        onClick={() => handleUpdateSubAreaName(sub.id)}
                        disabled={savingAreaId === sub.id}
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        className={styles.btnSmall}
                        onClick={() => { setEditingSubAreaId(null); setEditSubAreaName(''); }}
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <span className={styles.subareaName}>{sub.name}</span>
                      <button
                        type="button"
                        className={styles.btnSmall}
                        onClick={() => { setEditingSubAreaId(sub.id); setEditSubAreaName(sub.name); }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className={`${styles.btnSmall} ${styles.btnSmallDanger}`}
                        onClick={() => setConfirmDelete({ subarea: sub.id })}
                      >
                        Eliminar subárea
                      </button>
                    </>
                  )}
                </div>
                <ul className={styles.contactsList}>
                  {sub.contacts.map((c) => (
                    <li key={c.id} className={styles.contactRow}>
                      {editingContactId === c.id ? (
                        <>
                          <input
                            type="text"
                            value={editContactName}
                            onChange={(e) => setEditContactName(e.target.value)}
                            placeholder="Nombre"
                            size={12}
                          />
                          <input
                            type="email"
                            value={editContactEmail}
                            onChange={(e) => setEditContactEmail(e.target.value)}
                            placeholder="Email"
                            size={20}
                          />
                          <button
                            type="button"
                            className={styles.btnSmall}
                            onClick={() => handleUpdateContact(c.id)}
                            disabled={savingAreaId === c.id}
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            className={styles.btnSmall}
                            onClick={() => setEditingContactId(null)}
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <span className={styles.contactText}>{c.name}, {c.email}</span>
                          <span className={styles.contactActions}>
                            <button
                              type="button"
                              className={styles.btnSmall}
                              onClick={() => {
                                setEditingContactId(c.id);
                                setEditContactName(c.name);
                                setEditContactEmail(c.email);
                              }}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className={`${styles.btnSmall} ${styles.btnSmallDanger}`}
                              onClick={() => setConfirmDelete({ contact: c.id })}
                            >
                              Eliminar
                            </button>
                          </span>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
                {addingContactSubAreaId === sub.id ? (
                  <form onSubmit={(e) => handleAddContact(sub.id, e)} className={styles.addContactRow}>
                    <input
                      type="text"
                      value={newContactName}
                      onChange={(e) => setNewContactName(e.target.value)}
                      placeholder="Nombre contacto"
                      required
                    />
                    <input
                      type="email"
                      value={newContactEmail}
                      onChange={(e) => setNewContactEmail(e.target.value)}
                      placeholder="Email"
                      required
                    />
                    <button type="submit" disabled={savingAreaId === sub.id} className={styles.btnPrimary}>
                      Añadir
                    </button>
                    <button
                      type="button"
                      className={styles.btnSmall}
                      onClick={() => {
                        setAddingContactSubAreaId(null);
                        setNewContactName('');
                        setNewContactEmail('');
                      }}
                    >
                      Cancelar
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    className={styles.btnSmall}
                    onClick={() => setAddingContactSubAreaId(sub.id)}
                  >
                    + Añadir contacto
                  </button>
                )}
              </div>
            ))}
            {addingSubAreaAreaId === area.id ? (
              <form onSubmit={(e) => handleAddSubArea(area.id, e)} className={styles.addContactRow}>
                <input
                  type="text"
                  value={newSubAreaName}
                  onChange={(e) => setNewSubAreaName(e.target.value)}
                  placeholder="Nombre de la subárea"
                  required
                />
                <button type="submit" disabled={savingAreaId === area.id} className={styles.btnPrimary}>
                  Crear subárea
                </button>
                <button
                  type="button"
                  className={styles.btnSmall}
                  onClick={() => { setAddingSubAreaAreaId(null); setNewSubAreaName(''); }}
                >
                  Cancelar
                </button>
              </form>
            ) : (
              <button
                type="button"
                className={styles.btnSmall}
                onClick={() => setAddingSubAreaAreaId(area.id)}
              >
                + Nueva subárea
              </button>
            )}
          </div>
        </div>
      ))}

      <ConfirmDialog
        open={confirmDelete?.area != null}
        title="Eliminar área"
        message="¿Eliminar esta área, sus subáreas y contactos? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => confirmDelete?.area && handleDeleteArea(confirmDelete.area)}
        onCancel={() => setConfirmDelete(null)}
      />
      <ConfirmDialog
        open={confirmDelete?.subarea != null}
        title="Eliminar subárea"
        message="¿Eliminar esta subárea y sus contactos?"
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => confirmDelete?.subarea && handleDeleteSubArea(confirmDelete.subarea)}
        onCancel={() => setConfirmDelete(null)}
      />
      <ConfirmDialog
        open={confirmDelete?.contact != null}
        title="Eliminar contacto"
        message="¿Eliminar este contacto?"
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => confirmDelete?.contact && handleDeleteContact(confirmDelete.contact)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
