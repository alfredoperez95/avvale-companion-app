'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import styles from './admin.module.css';

type AreaContact = { id: string; name: string; email: string };
type Area = { id: string; name: string; contacts: AreaContact[] };

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [areas, setAreas] = useState<Area[]>([]);
  const [error, setError] = useState('');
  const [newAreaName, setNewAreaName] = useState('');
  const [savingAreaId, setSavingAreaId] = useState<string | null>(null);
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [editingAreaName, setEditingAreaName] = useState('');
  const [addingContactAreaId, setAddingContactAreaId] = useState<string | null>(null);
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editContactName, setEditContactName] = useState('');
  const [editContactEmail, setEditContactEmail] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ area?: string; contact?: string } | null>(null);

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
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? 'Error al crear el área');
        return;
      }
      setNewAreaName('');
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

  const handleAddContact = async (areaId: string, e: React.FormEvent) => {
    e.preventDefault();
    const name = newContactName.trim();
    const email = newContactEmail.trim();
    if (!name || !email) return;
    setError('');
    setSavingAreaId(areaId);
    try {
      const res = await apiFetch(`/api/areas/${areaId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? 'Error al añadir contacto');
        return;
      }
      setAddingContactAreaId(null);
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
      const res = await apiFetch(`/api/areas/contacts/${contactId}`, {
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
      const res = await apiFetch(`/api/areas/contacts/${contactId}`, { method: 'DELETE' });
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
      <h1 className={styles.h1}>Configuración: Áreas y contactos</h1>
      {error && <p className={styles.error}>{error}</p>}

      <form onSubmit={handleCreateArea} className={styles.addAreaRow}>
        <input
          type="text"
          className={styles.addAreaRow.input}
          value={newAreaName}
          onChange={(e) => setNewAreaName(e.target.value)}
          placeholder="Nombre del área"
          aria-label="Nombre del área"
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
          <ul className={styles.contactsList}>
            {area.contacts.map((c) => (
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
                      onClick={() => { setEditingContactId(null); }}
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
                        onClick={() => { setEditingContactId(c.id); setEditContactName(c.name); setEditContactEmail(c.email); }}
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
          {addingContactAreaId === area.id ? (
            <form onSubmit={(e) => handleAddContact(area.id, e)} className={styles.addContactRow}>
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
              <button type="submit" disabled={savingAreaId === area.id} className={styles.btnPrimary}>
                Añadir
              </button>
              <button
                type="button"
                className={styles.btnSmall}
                onClick={() => { setAddingContactAreaId(null); setNewContactName(''); setNewContactEmail(''); }}
              >
                Cancelar
              </button>
            </form>
          ) : (
            <button
              type="button"
              className={styles.btnSmall}
              onClick={() => setAddingContactAreaId(area.id)}
            >
              + Añadir contacto
            </button>
          )}
        </div>
      ))}

      <ConfirmDialog
        open={confirmDelete?.area != null}
        title="Eliminar área"
        message="¿Eliminar esta área y todos sus contactos? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => confirmDelete?.area && handleDeleteArea(confirmDelete.area)}
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
