'use client';

import { useEffect, useMemo, useState } from 'react';
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
type CcContactItem = { id: string; name: string; email: string };

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
  const [ccContacts, setCcContacts] = useState<CcContactItem[]>([]);
  const [newCcName, setNewCcName] = useState('');
  const [newCcEmail, setNewCcEmail] = useState('');
  const [savingCcId, setSavingCcId] = useState<string | null>(null);
  const [editingCcId, setEditingCcId] = useState<string | null>(null);
  const [editCcName, setEditCcName] = useState('');
  const [editCcEmail, setEditCcEmail] = useState('');
  const [confirmDeleteCcId, setConfirmDeleteCcId] = useState<string | null>(null);

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
        Promise.all([loadAreas(), loadCcContacts()]).finally(() => setLoading(false));
      })
      .catch(() => setLoading(false));
  }, []);

  const loadCcContacts = async () => {
    const res = await apiFetch('/api/cc-contacts');
    if (!res.ok) return;
    const data = await res.json();
    setCcContacts(Array.isArray(data) ? data : []);
  };

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

  const handleCreateCcContact = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCcName.trim();
    const email = newCcEmail.trim();
    if (!name || !email) return;
    setError('');
    setSavingCcId('new');
    try {
      const res = await apiFetch('/api/cc-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? 'Error al añadir contacto CC');
        return;
      }
      setNewCcName('');
      setNewCcEmail('');
      await loadCcContacts();
    } finally {
      setSavingCcId(null);
    }
  };

  const handleUpdateCcContact = async (id: string) => {
    const name = editCcName.trim();
    const email = editCcEmail.trim();
    if (!name || !email) return;
    setError('');
    setSavingCcId(id);
    try {
      const res = await apiFetch(`/api/cc-contacts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? 'Error al actualizar');
        return;
      }
      setEditingCcId(null);
      await loadCcContacts();
    } finally {
      setSavingCcId(null);
    }
  };

  const handleDeleteCcContact = async (id: string) => {
    setError('');
    try {
      const res = await apiFetch(`/api/cc-contacts/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? 'Error al eliminar');
        return;
      }
      setConfirmDeleteCcId(null);
      await loadCcContacts();
    } catch {
      setError('Error de conexión');
    }
  };

  const ccGroups = useMemo(() => {
    const map = new Map<string, CcContactItem[]>();
    for (const c of ccContacts) {
      const first = (c.name.trim() || c.email)[0]?.toUpperCase() ?? '#';
      const letter = /^[A-Z]$/.test(first) ? first : '#';
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter)!.push(c);
    }
    const keys = Array.from(map.keys()).sort((a, b) =>
      a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b),
    );
    return keys.map((k) => ({ letter: k, contacts: map.get(k)! }));
  }, [ccContacts]);

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
      <h1 className={styles.h1}>Configuración</h1>
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.tilesGrid}>
        <article className={styles.tile} aria-labelledby="cc-contacts-heading">
          <h2 id="cc-contacts-heading" className={styles.tileTitle}>Contactos CC</h2>
          <p className={styles.tileDesc}>
            Destinatarios en copia que aparecen como sugerencias al crear o editar una activación.
          </p>
        <form onSubmit={handleCreateCcContact} className={styles.ccAddRow}>
          <input
            type="text"
            value={newCcName}
            onChange={(e) => setNewCcName(e.target.value)}
            placeholder="Nombre"
            aria-label="Nombre del contacto CC"
            className={styles.ccInput}
            required
          />
          <input
            type="email"
            value={newCcEmail}
            onChange={(e) => setNewCcEmail(e.target.value)}
            placeholder="Email"
            aria-label="Email del contacto CC"
            className={styles.ccInput}
            required
          />
          <button type="submit" disabled={savingCcId === 'new'} className={styles.btnPrimary}>
            {savingCcId === 'new' ? 'Guardando…' : 'Añadir'}
          </button>
        </form>
        <div className={styles.ccScrollWrap}>
          <div className={styles.ccTableWrap}>
            <table className={styles.ccTable}>
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">Email</th>
                  <th scope="col" className={styles.ccColActions}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ccContacts.length === 0 ? (
                  <tr>
                    <td colSpan={3} className={styles.ccEmpty}>
                      No hay contactos CC. Añade uno con el formulario de arriba.
                    </td>
                  </tr>
                ) : (
                  ccGroups.flatMap((g) => [
                    <tr key={`letter-${g.letter}`}>
                      <td colSpan={3} className={styles.ccLetterRow}>
                        {g.letter === '#' ? 'Otros' : g.letter}
                      </td>
                    </tr>,
                    ...g.contacts.map((c) => (
                      <tr key={c.id}>
                        {editingCcId === c.id ? (
                          <>
                            <td>
                              <input
                                type="text"
                                value={editCcName}
                                onChange={(e) => setEditCcName(e.target.value)}
                                placeholder="Nombre"
                                className={styles.ccCellInput}
                                aria-label="Nombre"
                              />
                            </td>
                            <td>
                              <input
                                type="email"
                                value={editCcEmail}
                                onChange={(e) => setEditCcEmail(e.target.value)}
                                placeholder="Email"
                                className={styles.ccCellInput}
                                aria-label="Email"
                              />
                            </td>
                            <td className={styles.ccColActions}>
                              <button
                                type="button"
                                className={styles.btnSmall}
                                onClick={() => handleUpdateCcContact(c.id)}
                                disabled={savingCcId === c.id}
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                className={styles.btnSmall}
                                onClick={() => setEditingCcId(null)}
                              >
                                Cancelar
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className={styles.ccCellName}>{c.name}</td>
                            <td className={styles.ccCellEmail}>{c.email}</td>
                            <td className={styles.ccColActions}>
                              <button
                                type="button"
                                className={styles.btnSmall}
                                onClick={() => {
                                  setEditingCcId(c.id);
                                  setEditCcName(c.name);
                                  setEditCcEmail(c.email);
                                }}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className={`${styles.btnSmall} ${styles.btnSmallDanger}`}
                                onClick={() => setConfirmDeleteCcId(c.id)}
                              >
                                Eliminar
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    )),
                  ])
                )}
              </tbody>
            </table>
          </div>
        </div>
        </article>

        <article className={styles.tile} aria-labelledby="areas-heading">
          <h2 id="areas-heading" className={styles.tileTitle}>Áreas</h2>
          <p className={styles.tileDesc}>
            Áreas, directores y subáreas que definen los destinatarios de cada activación.
          </p>
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
        </article>
      </div>

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
      <ConfirmDialog
        open={confirmDeleteCcId != null}
        title="Eliminar contacto CC"
        message="¿Eliminar este contacto de la lista CC?"
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => confirmDeleteCcId && handleDeleteCcContact(confirmDeleteCcId)}
        onCancel={() => setConfirmDeleteCcId(null)}
      />
    </div>
  );
}
