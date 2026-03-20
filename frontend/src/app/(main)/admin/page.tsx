'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import styles from './admin.module.css';

type UserItem = {
  id: string;
  email: string;
  name?: string | null;
  lastName?: string | null;
  position?: string | null;
  appearance?: string | null;
  role: string;
  enabled?: boolean;
  createdAt: string;
};

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newPosition, setNewPosition] = useState('');
  const [newRole, setNewRole] = useState<'USER' | 'ADMIN'>('USER');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [editRole, setEditRole] = useState<'USER' | 'ADMIN'>('USER');
  const [editEnabled, setEditEnabled] = useState(true);
  const [editNewPassword, setEditNewPassword] = useState('');
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const loadUsers = async () => {
    const res = await apiFetch('/api/users');
    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    setUsers(Array.isArray(data) ? data : []);
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
        if (user?.id) setCurrentUserId(user.id);
        loadUsers().finally(() => setLoading(false));
      })
      .catch(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmail.trim();
    const password = newPassword;
    if (!email || !password || password.length < 6) {
      setError('Email y contraseña (mín. 6 caracteres) son obligatorios.');
      return;
    }
    setError('');
    setSavingId('new');
    try {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          name: newName.trim() || undefined,
          position: newPosition.trim() || undefined,
          role: newRole,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? 'Error al crear usuario');
        return;
      }
      setNewEmail('');
      setNewPassword('');
      setNewName('');
      setNewPosition('');
      setNewRole('USER');
      setShowCreate(false);
      await loadUsers();
    } finally {
      setSavingId(null);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    const payload: { email?: string; position?: string; role?: string; enabled?: boolean; newPassword?: string } = { role: editRole, enabled: editEnabled };
    if (editEmail.trim()) payload.email = editEmail.trim();
    payload.position = editPosition.trim();
    if (editNewPassword.trim().length >= 6) payload.newPassword = editNewPassword;
    setError('');
    setSavingId(editingId);
    try {
      const res = await apiFetch(`/api/users/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? 'Error al actualizar');
        return;
      }
      setEditingId(null);
      setEditNewPassword('');
      setEditEmail('');
      setEditPosition('');
      setShowPasswordField(false);
      await loadUsers();
    } finally {
      setSavingId(null);
    }
  };

  const openEdit = (u: UserItem) => {
    setEditingId(u.id);
    setEditEmail(u.email ?? '');
    setEditPosition(u.position ?? '');
    setEditRole((u.role as 'USER' | 'ADMIN') || 'USER');
    setEditEnabled(u.enabled !== false);
    setEditNewPassword('');
    setShowPasswordField(false);
    setError('');
  };

  if (loading) return null;

  if (forbidden) {
    return (
      <div className={styles.page}>
        <Link href="/launcher" className={styles.back}>← Inicio</Link>
        <p className={styles.forbidden}>No tienes permisos para acceder a esta sección.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link href="/launcher" className={styles.back}>← Inicio</Link>
      <h1 className={styles.h1}>Gestión de usuarios</h1>
      <p className={styles.sectionDesc}>
        Crear usuarios y modificar permisos o contraseñas. Solo visible para administradores.
      </p>
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Crear usuario</h2>
        <p className={styles.cardDesc}>
          Añade un nuevo usuario con email y contraseña. Opcionalmente asigna nombre, puesto y rol.
        </p>
        {!showCreate ? (
          <button type="button" className={styles.btnPrimary} onClick={() => setShowCreate(true)}>
            Crear usuario
          </button>
        ) : (
          <form onSubmit={handleCreate} className={styles.createForm}>
            <div className={styles.createFormGrid}>
              <div className={styles.createFormRow}>
                <label htmlFor="new-email">Email</label>
                <input
                  id="new-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className={styles.input}
                  required
                  placeholder="usuario@ejemplo.com"
                />
              </div>
              <div className={styles.createFormRow}>
                <label htmlFor="new-password">Contraseña</label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={styles.input}
                  required
                  minLength={6}
                  placeholder="Mín. 6 caracteres"
                />
              </div>
              <div className={styles.createFormRow}>
                <label htmlFor="new-name">Nombre</label>
                <input
                  id="new-name"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className={styles.input}
                  placeholder="Opcional"
                />
              </div>
              <div className={styles.createFormRow}>
                <label htmlFor="new-position">Puesto</label>
                <input
                  id="new-position"
                  type="text"
                  value={newPosition}
                  onChange={(e) => setNewPosition(e.target.value)}
                  className={styles.input}
                  placeholder="Opcional"
                />
              </div>
              <div className={styles.createFormRow}>
                <label htmlFor="new-role">Rol</label>
                <select
                  id="new-role"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'USER' | 'ADMIN')}
                  className={styles.select}
                >
                  <option value="USER">Usuario</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>
            </div>
            <div className={styles.createFormActions}>
              <button type="submit" disabled={savingId === 'new'} className={styles.btnPrimary}>
                {savingId === 'new' ? 'Guardando…' : 'Crear usuario'}
              </button>
              <button
                type="button"
                className={styles.btnSmall}
                onClick={() => {
                  setShowCreate(false);
                  setError('');
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Usuarios</h2>
        <div className={styles.scrollWrap}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">Email</th>
                  <th scope="col">Puesto</th>
                  <th scope="col">Rol</th>
                  <th scope="col">Estado</th>
                  <th scope="col" className={styles.colActions}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={styles.empty}>
                      No hay usuarios.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id}>
                      <td className={styles.cellName}>
                        <span className={styles.cellNameWrap}>
                          <span>{[u.name, u.lastName].filter(Boolean).join(' ') || '—'}</span>
                          {u.id === currentUserId && (
                            <span className={styles.badgeCurrentUser}>Tu usuario</span>
                          )}
                        </span>
                      </td>
                      <td className={styles.cellEmail}>{u.email}</td>
                      <td>{u.position || '—'}</td>
                      <td>{u.role === 'ADMIN' ? 'Administrador' : 'Usuario'}</td>
                      <td>
                        <span className={u.enabled !== false ? styles.badgeEnabled : styles.badgeDisabled}>
                          {u.enabled !== false ? 'Habilitado' : 'Deshabilitado'}
                        </span>
                      </td>
                      <td className={styles.colActions}>
                        <button
                          type="button"
                          className={styles.btnSmall}
                          onClick={() => openEdit(u)}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editingId != null && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-user-title"
          onClick={(e) => e.target === e.currentTarget && setEditingId(null)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <header className={styles.modalHeader}>
              <h2 id="edit-user-title" className={styles.modalTitle}>Editar usuario</h2>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => { setEditingId(null); setError(''); }}
                aria-label="Cerrar"
              >
                <span aria-hidden>×</span>
              </button>
            </header>
            <form onSubmit={handleUpdate}>
              <div className={styles.modalBody}>
                {error && <p className={styles.error}>{error}</p>}
                <div className={styles.modalFormRow}>
                  <label htmlFor="edit-email">Correo electrónico</label>
                  <input
                    id="edit-email"
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className={styles.input}
                    required
                    placeholder="usuario@ejemplo.com"
                  />
                </div>
                <div className={styles.modalFormRow}>
                  <label htmlFor="edit-position">Puesto</label>
                  <input
                    id="edit-position"
                    type="text"
                    value={editPosition}
                    onChange={(e) => setEditPosition(e.target.value)}
                    className={styles.input}
                    placeholder="Ej. Consultor, Director..."
                  />
                </div>
                <div className={styles.modalFormRow}>
                  <label htmlFor="edit-role">Rol</label>
                  <select
                    id="edit-role"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as 'USER' | 'ADMIN')}
                    className={styles.select}
                  >
                    <option value="USER">Usuario</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                </div>
                <div>
                  <label className={styles.switchRow}>
                    <span className={styles.switch}>
                      <input
                        type="checkbox"
                        id="edit-enabled"
                        role="switch"
                        checked={editEnabled}
                        onChange={(e) => setEditEnabled(e.target.checked)}
                        disabled={editingId === currentUserId}
                        aria-label="Usuario habilitado"
                      />
                      <span className={styles.switchTrack} aria-hidden />
                      <span className={styles.switchThumb} aria-hidden />
                    </span>
                    <span className={styles.switchLabel}>Usuario habilitado</span>
                  </label>
                  {editingId === currentUserId && (
                    <p className={styles.switchLegend}>
                      No puedes deshabilitar tu propio usuario.
                    </p>
                  )}
                </div>
              </div>
              <div className={styles.modalActions}>
                <div className={styles.modalActionsLeft}>
                  <button
                    type="button"
                    className={styles.btnSmall}
                    onClick={() => setShowPasswordField((v) => !v)}
                    aria-pressed={showPasswordField}
                  >
                    {showPasswordField ? 'Ocultar contraseña' : 'Restablecer contraseña'}
                  </button>
                  {showPasswordField && (
                    <input
                      id="edit-password"
                      type="password"
                      value={editNewPassword}
                      onChange={(e) => setEditNewPassword(e.target.value)}
                      className={styles.modalPasswordInput}
                      minLength={6}
                      placeholder="Nueva contraseña (mín. 6 caracteres)"
                      aria-label="Nueva contraseña"
                    />
                  )}
                </div>
                <div className={styles.modalActionsRight}>
                  <button
                    type="button"
                    className={styles.btnSmall}
                    onClick={() => { setEditingId(null); setError(''); }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingId === editingId}
                    className={styles.btnPrimary}
                  >
                    {savingId === editingId ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
