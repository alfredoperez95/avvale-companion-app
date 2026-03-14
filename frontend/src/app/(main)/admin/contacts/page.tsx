'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import styles from '../admin.module.css';

type ContactItem = { id: string; name: string; email: string };

export default function AdminContactsPage() {
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadContacts = async () => {
    const res = await apiFetch('/api/contacts');
    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    setContacts(Array.isArray(data) ? data : []);
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
        loadContacts().finally(() => setLoading(false));
      })
      .catch(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    const email = newEmail.trim();
    if (!name || !email) return;
    setError('');
    setSavingId('new');
    try {
      const res = await apiFetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? 'Error al añadir contacto');
        return;
      }
      setNewName('');
      setNewEmail('');
      await loadContacts();
    } finally {
      setSavingId(null);
    }
  };

  const handleUpdate = async (id: string) => {
    const name = editName.trim();
    const email = editEmail.trim();
    if (!name || !email) return;
    setError('');
    setSavingId(id);
    try {
      const res = await apiFetch(`/api/contacts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? 'Error al actualizar');
        return;
      }
      setEditingId(null);
      await loadContacts();
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setError('');
    try {
      const res = await apiFetch(`/api/contacts/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? 'Error al eliminar');
        return;
      }
      setConfirmDeleteId(null);
      await loadContacts();
    } catch {
      setError('Error de conexión');
    }
  };

  const contactGroups = useMemo(() => {
    const map = new Map<string, ContactItem[]>();
    for (const c of contacts) {
      const first = (c.name.trim() || c.email)[0]?.toUpperCase() ?? '#';
      const letter = /^[A-Z]$/.test(first) ? first : '#';
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter)!.push(c);
    }
    const keys = Array.from(map.keys()).sort((a, b) =>
      a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b),
    );
    return keys.map((k) => ({ letter: k, contacts: map.get(k)! }));
  }, [contacts]);

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
      <h1 className={styles.h1}>Contactos</h1>
      <p className={styles.sectionDesc}>
        Destinatarios en copia que aparecen como sugerencias al crear o editar una activación.
      </p>
      {error && <p className={styles.error}>{error}</p>}

      <form onSubmit={handleCreate} className={styles.contactsAddRow}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nombre"
          aria-label="Nombre del contacto"
          className={styles.contactsInput}
          required
        />
        <input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="Email"
          aria-label="Email del contacto"
          className={styles.contactsInput}
          required
        />
        <button type="submit" disabled={savingId === 'new'} className={styles.btnPrimary}>
          {savingId === 'new' ? 'Guardando…' : 'Añadir'}
        </button>
      </form>

      <div className={styles.contactsScrollWrap}>
        <div className={styles.contactsTableWrap}>
          <table className={styles.contactsTable}>
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Email</th>
                <th scope="col" className={styles.contactsColActions}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={3} className={styles.contactsEmpty}>
                    No hay contactos. Añade uno con el formulario de arriba.
                  </td>
                </tr>
              ) : (
                contactGroups.flatMap((g) => [
                  <tr key={`letter-${g.letter}`}>
                    <td colSpan={3} className={styles.contactsLetterRow}>
                      {g.letter === '#' ? 'Otros' : g.letter}
                    </td>
                  </tr>,
                  ...g.contacts.map((c) => (
                    <tr key={c.id}>
                      {editingId === c.id ? (
                        <>
                          <td>
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              placeholder="Nombre"
                              className={styles.contactsCellInput}
                              aria-label="Nombre"
                            />
                          </td>
                          <td>
                            <input
                              type="email"
                              value={editEmail}
                              onChange={(e) => setEditEmail(e.target.value)}
                              placeholder="Email"
                              className={styles.contactsCellInput}
                              aria-label="Email"
                            />
                          </td>
                          <td className={styles.contactsColActions}>
                            <button
                              type="button"
                              className={styles.btnSmall}
                              onClick={() => handleUpdate(c.id)}
                              disabled={savingId === c.id}
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              className={styles.btnSmall}
                              onClick={() => setEditingId(null)}
                            >
                              Cancelar
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className={styles.contactsCellName}>{c.name}</td>
                          <td className={styles.contactsCellEmail}>{c.email}</td>
                          <td className={styles.contactsColActions}>
                            <button
                              type="button"
                              className={styles.btnSmall}
                              onClick={() => {
                                setEditingId(c.id);
                                setEditName(c.name);
                                setEditEmail(c.email);
                              }}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className={`${styles.btnSmall} ${styles.btnSmallDanger}`}
                              onClick={() => setConfirmDeleteId(c.id)}
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
        open={confirmDeleteId != null}
        title="Eliminar contacto"
        message="¿Eliminar este contacto de la lista?"
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
