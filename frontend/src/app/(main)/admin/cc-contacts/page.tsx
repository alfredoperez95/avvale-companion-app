'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import styles from '../admin.module.css';

type CcContactItem = { id: string; name: string; email: string };

export default function AdminCcContactsPage() {
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [ccContacts, setCcContacts] = useState<CcContactItem[]>([]);
  const [error, setError] = useState('');
  const [newCcName, setNewCcName] = useState('');
  const [newCcEmail, setNewCcEmail] = useState('');
  const [savingCcId, setSavingCcId] = useState<string | null>(null);
  const [editingCcId, setEditingCcId] = useState<string | null>(null);
  const [editCcName, setEditCcName] = useState('');
  const [editCcEmail, setEditCcEmail] = useState('');
  const [confirmDeleteCcId, setConfirmDeleteCcId] = useState<string | null>(null);

  const loadCcContacts = async () => {
    const res = await apiFetch('/api/cc-contacts');
    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    setCcContacts(Array.isArray(data) ? data : []);
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
        loadCcContacts().finally(() => setLoading(false));
      })
      .catch(() => setLoading(false));
  }, []);

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
        <Link href="/admin" className={styles.back}>← Configuración</Link>
        <p className={styles.forbidden}>No tienes permisos para acceder a esta sección.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link href="/admin" className={styles.back}>← Configuración</Link>
      <h1 className={styles.h1}>Contactos CC</h1>
      <p className={styles.sectionDesc}>
        Destinatarios en copia que aparecen como sugerencias al crear o editar una activación.
      </p>
      {error && <p className={styles.error}>{error}</p>}

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
