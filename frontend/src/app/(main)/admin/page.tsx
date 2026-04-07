'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { apiFetch, redirectToLogin } from '@/lib/api';
import { PageBreadcrumb, PageBackLink, PageHero, ChevronBackIcon } from '@/components/page-hero';
import { industryLabel, USER_INDUSTRY_OPTIONS, type UserIndustryValue } from '@/lib/user-industry';
import {
  positionLabel,
  getPositionOptionsForAdminEditor,
  type UserPositionValue,
} from '@/lib/user-position';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import styles from './admin.module.css';

type UserItem = {
  id: string;
  email: string;
  name?: string | null;
  lastName?: string | null;
  position?: string | null;
  industry?: string | null;
  appearance?: string | null;
  role: string;
  enabled?: boolean;
  createdAt: string;
  /** Indica si el usuario guardó clave Anthropic para funciones de IA (no expone la clave). */
  hasAnthropicApiKey?: boolean;
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
  const [newLastName, setNewLastName] = useState('');
  const [newPosition, setNewPosition] = useState<'' | UserPositionValue>('');
  const [newIndustry, setNewIndustry] = useState<'' | UserIndustryValue>('');
  const [newRole, setNewRole] = useState<'USER' | 'ADMIN'>('USER');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editName, setEditName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPosition, setEditPosition] = useState<'' | UserPositionValue>('');
  const [editIndustry, setEditIndustry] = useState<'' | UserIndustryValue>('');
  const [editRole, setEditRole] = useState<'USER' | 'ADMIN'>('USER');
  const [editEnabled, setEditEnabled] = useState(true);
  const [editNewPassword, setEditNewPassword] = useState('');
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [invName, setInvName] = useState('');
  const [invLastName, setInvLastName] = useState('');
  const [invEmail, setInvEmail] = useState('');
  const [invPosition, setInvPosition] = useState<'' | UserPositionValue>('');
  const [invIndustry, setInvIndustry] = useState<'' | UserIndustryValue>('');
  const [invRole, setInvRole] = useState<'USER' | 'ADMIN'>('USER');
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const inviteWrapRef = useRef<HTMLDivElement>(null);

  const loadUsers = async () => {
    const res = await apiFetch('/api/users');
    if (res.status === 401) {
      redirectToLogin();
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
          redirectToLogin();
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

  useEffect(() => {
    if (!inviteOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInviteOpen(false);
    };
    const onDocClick = (e: MouseEvent) => {
      if (inviteWrapRef.current && !inviteWrapRef.current.contains(e.target as Node)) {
        setInviteOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onDocClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onDocClick);
    };
  }, [inviteOpen]);

  useEffect(() => {
    if (editingId === null) setDeleteDialogOpen(false);
  }, [editingId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');
    setInviteSuccess(false);
    const name = invName.trim();
    const lastName = invLastName.trim();
    const email = invEmail.trim().toLowerCase();
    if (!name || !lastName || !email) {
      setInviteError('Nombre, apellido y email son obligatorios.');
      return;
    }
    setInviteSaving(true);
    try {
      const body: Record<string, string> = { email, name, lastName };
      if (invPosition) body.position = invPosition;
      if (invIndustry) body.industry = invIndustry;
      if (invRole !== 'USER') body.role = invRole;
      const res = await apiFetch('/api/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.message;
        setInviteError(
          Array.isArray(msg)
            ? msg.join(' ')
            : typeof msg === 'string'
              ? msg
              : 'No se pudo enviar la invitación.',
        );
        return;
      }
      setInviteSuccess(true);
      setInvName('');
      setInvLastName('');
      setInvEmail('');
      setInvPosition('');
      setInvIndustry('');
      setInvRole('USER');
      await loadUsers();
    } finally {
      setInviteSaving(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmail.trim();
    const password = newPassword;
    const name = newName.trim();
    const lastName = newLastName.trim();
    if (!email || !password || password.length < 6 || !name || !lastName || !newPosition) {
      setError('Nombre, apellido, puesto, email y contraseña (mín. 6 caracteres) son obligatorios.');
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
          name,
          lastName,
          position: newPosition,
          ...(newIndustry !== '' ? { industry: newIndustry } : {}),
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
      setNewLastName('');
      setNewPosition('');
      setNewIndustry('');
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
    const name = editName.trim();
    const lastName = editLastName.trim();
    if (!name || !lastName) {
      setError('Nombre y apellido son obligatorios.');
      return;
    }
    const payload: {
      name: string;
      lastName: string;
      email?: string;
      position?: UserPositionValue | null;
      industry?: UserIndustryValue | null;
      role?: string;
      enabled?: boolean;
      newPassword?: string;
    } = { name, lastName, role: editRole, enabled: editEnabled };
    if (editEmail.trim()) payload.email = editEmail.trim();
    payload.position = editPosition === '' ? null : editPosition;
    payload.industry = editIndustry === '' ? null : editIndustry;
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
      setEditName('');
      setEditLastName('');
      setEditPosition('');
      setEditIndustry('');
      setShowPasswordField(false);
      await loadUsers();
    } finally {
      setSavingId(null);
    }
  };

  const openDeleteDialog = () => {
    if (!editingId || editingId === currentUserId) return;
    setDeleteDialogOpen(true);
  };

  const executeDeleteUser = async () => {
    if (!editingId || editingId === currentUserId) return;
    setError('');
    setDeleteBusy(true);
    try {
      const res = await apiFetch(`/api/users/${editingId}`, { method: 'DELETE' });
      if (res.status === 204) {
        setDeleteDialogOpen(false);
        setEditingId(null);
        setEditNewPassword('');
        setEditEmail('');
        setEditName('');
        setEditLastName('');
        setEditPosition('');
        setEditIndustry('');
        setShowPasswordField(false);
        await loadUsers();
        return;
      }
      setDeleteDialogOpen(false);
      const data = await res.json().catch(() => ({}));
      const msg = data.message;
      setError(
        Array.isArray(msg)
          ? msg.join(' ')
          : typeof msg === 'string'
            ? msg
            : 'No se pudo eliminar el usuario.',
      );
    } finally {
      setDeleteBusy(false);
    }
  };

  const openEdit = (u: UserItem) => {
    setEditingId(u.id);
    setEditEmail(u.email ?? '');
    setEditName((u.name ?? '').trim());
    setEditLastName((u.lastName ?? '').trim());
    setEditPosition((u.position as UserPositionValue | null | undefined) ?? '');
    setEditIndustry((u.industry as UserIndustryValue | null | undefined) ?? '');
    setEditRole((u.role as 'USER' | 'ADMIN') || 'USER');
    setEditEnabled(u.enabled !== false);
    setEditNewPassword('');
    setShowPasswordField(false);
    setError('');
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <PageBreadcrumb>
          <PageBackLink href="/launcher/activations/dashboard">
            <ChevronBackIcon />
            Dashboard
          </PageBackLink>
        </PageBreadcrumb>
        <div className={styles.loadingState} role="status" aria-live="polite">
          <span className={styles.loadingSpinner} aria-hidden />
          <span>Cargando administración…</span>
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className={styles.page}>
        <PageBreadcrumb>
          <PageBackLink href="/launcher/activations/dashboard">
            <ChevronBackIcon />
            Dashboard
          </PageBackLink>
        </PageBreadcrumb>
        <div className={styles.forbiddenCard} role="alert">
          <h1 className={styles.forbiddenTitle}>Acceso restringido</h1>
          <p className={styles.forbiddenText}>
            Solo los administradores pueden abrir esta sección. Vuelve al dashboard o pide permisos a un admin.
          </p>
          <PageBackLink href="/launcher/activations/dashboard" className={styles.forbiddenLink}>
            <ChevronBackIcon />
            Ir al dashboard
          </PageBackLink>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <PageBreadcrumb>
        <PageBackLink href="/launcher/activations/dashboard">
          <ChevronBackIcon />
          Dashboard
        </PageBackLink>
      </PageBreadcrumb>
      <PageHero
        title="Gestión de usuarios"
        subtitle="Crea cuentas, asigna roles y revisa el estado de acceso y la clave de API para funciones de IA (Anthropic). Solo administradores ven esta pantalla."
      />
      {error ? (
        <div className={styles.errorBanner} role="alert">
          {error}
        </div>
      ) : null}

      <section className={styles.card} aria-labelledby="admin-create-heading">
        <h2 id="admin-create-heading" className={styles.cardTitle}>
          Crear usuario
        </h2>
        <p className={styles.cardDesc}>
          Alta directa con contraseña inicial. El usuario podrá cambiar datos en su perfil y guardar su propia clave de
          API para IA.
        </p>
        {!showCreate ? (
          <div className={styles.cardIntroActions}>
            <button type="button" className={styles.btnPrimary} onClick={() => setShowCreate(true)}>
              Crear usuario
            </button>
            <div className={styles.inviteWrap} ref={inviteWrapRef}>
              <button
                type="button"
                className={styles.btnSecondary}
                aria-expanded={inviteOpen}
                aria-haspopup="dialog"
                onClick={(e) => {
                  e.stopPropagation();
                  setInviteOpen((v) => !v);
                  setInviteError('');
                  setInviteSuccess(false);
                }}
              >
                Invitar usuario
              </button>
              {inviteOpen ? (
                <div
                  className={styles.invitePopover}
                  role="dialog"
                  aria-label="Invitar por correo electrónico"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className={styles.invitePopoverLead}>
                    Se enviará un enlace para completar el registro (contraseña y datos pendientes).
                  </p>
                  <form onSubmit={handleInvite} className={styles.inviteForm}>
                    <div className={styles.inviteNameRow}>
                      <div className={styles.inviteField}>
                        <label htmlFor="invite-name">Nombre</label>
                        <input
                          id="invite-name"
                          type="text"
                          value={invName}
                          onChange={(e) => setInvName(e.target.value)}
                          className={styles.input}
                          required
                          autoComplete="given-name"
                        />
                      </div>
                      <div className={styles.inviteField}>
                        <label htmlFor="invite-lastname">Apellido</label>
                        <input
                          id="invite-lastname"
                          type="text"
                          value={invLastName}
                          onChange={(e) => setInvLastName(e.target.value)}
                          className={styles.input}
                          required
                          autoComplete="family-name"
                        />
                      </div>
                    </div>
                    <div className={styles.inviteField}>
                      <label htmlFor="invite-email">Email</label>
                      <input
                        id="invite-email"
                        type="email"
                        value={invEmail}
                        onChange={(e) => setInvEmail(e.target.value)}
                        className={styles.input}
                        required
                        autoComplete="email"
                      />
                    </div>
                    <div className={styles.inviteField}>
                      <label htmlFor="invite-position">Puesto</label>
                      <select
                        id="invite-position"
                        value={invPosition}
                        onChange={(e) =>
                          setInvPosition((e.target.value || '') as '' | UserPositionValue)
                        }
                        className={styles.select}
                        aria-label="Puesto (opcional)"
                      >
                        <option value="">— Opcional —</option>
                        {getPositionOptionsForAdminEditor(users, null).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.inviteField}>
                      <label htmlFor="invite-industry">Industria</label>
                      <select
                        id="invite-industry"
                        value={invIndustry}
                        onChange={(e) =>
                          setInvIndustry((e.target.value || '') as '' | UserIndustryValue)
                        }
                        className={styles.select}
                      >
                        <option value="">— Opcional —</option>
                        {USER_INDUSTRY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.inviteField}>
                      <label htmlFor="invite-role">Rol</label>
                      <select
                        id="invite-role"
                        value={invRole}
                        onChange={(e) => setInvRole(e.target.value as 'USER' | 'ADMIN')}
                        className={styles.select}
                      >
                        <option value="USER">Usuario</option>
                        <option value="ADMIN">Administrador</option>
                      </select>
                    </div>
                    {inviteError ? (
                      <p className={styles.inviteError} role="alert">
                        {inviteError}
                      </p>
                    ) : null}
                    {inviteSuccess ? (
                      <p className={styles.inviteOk}>Invitación enviada por correo.</p>
                    ) : null}
                    <div className={styles.inviteActions}>
                      <button type="submit" className={styles.btnPrimary} disabled={inviteSaving}>
                        {inviteSaving ? 'Enviando…' : 'Enviar invitación'}
                      </button>
                      <button
                        type="button"
                        className={styles.btnSmall}
                        onClick={() => {
                          setInviteOpen(false);
                          setInviteError('');
                        }}
                      >
                        Cerrar
                      </button>
                    </div>
                  </form>
                </div>
              ) : null}
            </div>
            <Link href="/admin/invitations" className={`${styles.btnSecondary} ${styles.cardIntroLinkEnd}`}>
              Invitaciones
            </Link>
          </div>
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
              <div className={styles.createFormNameRow}>
                <div className={styles.createFormRow}>
                  <label htmlFor="new-name">Nombre</label>
                  <input
                    id="new-name"
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className={styles.input}
                    required
                    placeholder="Nombre"
                    autoComplete="given-name"
                  />
                </div>
                <div className={styles.createFormRow}>
                  <label htmlFor="new-lastname">Apellido</label>
                  <input
                    id="new-lastname"
                    type="text"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    className={styles.input}
                    required
                    placeholder="Apellido"
                    autoComplete="family-name"
                  />
                </div>
              </div>
              <div className={styles.createFormTripleRow}>
                <div className={styles.createFormRow}>
                  <label htmlFor="new-position">Puesto</label>
                  <select
                    id="new-position"
                    value={newPosition}
                    onChange={(e) =>
                      setNewPosition((e.target.value || '') as '' | UserPositionValue)
                    }
                    className={styles.select}
                    required
                    aria-label="Puesto"
                  >
                    <option value="">Seleccionar…</option>
                    {getPositionOptionsForAdminEditor(users, null).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
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
                <div className={styles.createFormRow}>
                  <label htmlFor="new-industry">Industria</label>
                  <select
                    id="new-industry"
                    value={newIndustry}
                    onChange={(e) =>
                      setNewIndustry((e.target.value || '') as '' | UserIndustryValue)
                    }
                    className={styles.select}
                  >
                    <option value="">— Opcional —</option>
                    {USER_INDUSTRY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
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
      </section>

      <section className={styles.card} aria-labelledby="admin-users-heading">
        <div className={styles.usersCardHead}>
          <div className={styles.usersCardHeadText}>
            <h2 id="admin-users-heading" className={styles.cardTitle}>
              Usuarios
            </h2>
            <p className={styles.cardDesc}>
              Listado de cuentas con acceso a la app. La columna API IA indica si hay clave Anthropic guardada en perfil.
            </p>
          </div>
          <span
            className={styles.userCountPill}
            title="Total de usuarios"
            aria-label={`${users.length} usuarios en total`}
          >
            {users.length}
          </span>
        </div>
        <div className={styles.scrollWrap}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">Email</th>
                  <th scope="col">Puesto</th>
                  <th scope="col">Industria</th>
                  <th scope="col">Rol</th>
                  <th scope="col">API IA</th>
                  <th scope="col">Estado</th>
                  <th scope="col" className={styles.colActions}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={8} className={styles.empty}>
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
                      <td>{positionLabel(u.position)}</td>
                      <td className={styles.cellIndustry}>{industryLabel(u.industry)}</td>
                      <td>{u.role === 'ADMIN' ? 'Administrador' : 'Usuario'}</td>
                      <td>
                        <span
                          className={
                            u.hasAnthropicApiKey ? styles.badgeAiYes : styles.badgeAiNo
                          }
                        >
                          {u.hasAnthropicApiKey ? (
                            <>
                              <img
                                src="/img/Claude_AI_symbol.svg"
                                alt=""
                                className={styles.badgeAiIcon}
                                width={14}
                                height={14}
                                decoding="async"
                                aria-hidden
                              />
                              Sí
                            </>
                          ) : (
                            'No'
                          )}
                        </span>
                      </td>
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
      </section>

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
                {error ? <div className={styles.modalError}>{error}</div> : null}
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
                <div className={styles.modalNameRow}>
                  <div className={styles.modalFormRow}>
                    <label htmlFor="edit-name">Nombre</label>
                    <input
                      id="edit-name"
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className={styles.input}
                      required
                      placeholder="Nombre"
                      autoComplete="given-name"
                    />
                  </div>
                  <div className={styles.modalFormRow}>
                    <label htmlFor="edit-lastname">Apellido</label>
                    <input
                      id="edit-lastname"
                      type="text"
                      value={editLastName}
                      onChange={(e) => setEditLastName(e.target.value)}
                      className={styles.input}
                      required
                      placeholder="Apellido"
                      autoComplete="family-name"
                    />
                  </div>
                </div>
                <div className={styles.modalFormRow}>
                  <label htmlFor="edit-position">Puesto</label>
                  <select
                    id="edit-position"
                    value={editPosition}
                    onChange={(e) =>
                      setEditPosition((e.target.value || '') as '' | UserPositionValue)
                    }
                    className={styles.select}
                    aria-label="Puesto"
                  >
                    <option value="">— Sin definir —</option>
                    {getPositionOptionsForAdminEditor(users, editingId).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.modalFormRow}>
                  <label htmlFor="edit-industry">Industria</label>
                  <select
                    id="edit-industry"
                    value={editIndustry}
                    onChange={(e) =>
                      setEditIndustry((e.target.value || '') as '' | UserIndustryValue)
                    }
                    className={styles.select}
                  >
                    <option value="">— Sin definir —</option>
                    {USER_INDUSTRY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
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
                    className={styles.btnDanger}
                    onClick={openDeleteDialog}
                    disabled={
                      deleteBusy ||
                      deleteDialogOpen ||
                      savingId === editingId ||
                      editingId === currentUserId
                    }
                    title={
                      editingId === currentUserId
                        ? 'No puedes eliminar tu propio usuario'
                        : undefined
                    }
                  >
                    Eliminar usuario
                  </button>
                  <button
                    type="button"
                    className={styles.btnSmall}
                    onClick={() => setShowPasswordField((v) => !v)}
                    aria-pressed={showPasswordField}
                    disabled={deleteBusy}
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
                      disabled={deleteBusy}
                    />
                  )}
                </div>
                <div className={styles.modalActionsRight}>
                  <button
                    type="button"
                    className={styles.btnSmall}
                    onClick={() => { setEditingId(null); setError(''); }}
                    disabled={deleteBusy}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingId === editingId || deleteBusy}
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

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Eliminar usuario"
        description={
          <>
            ¿Eliminar definitivamente la cuenta <strong>{editEmail}</strong>? Esta acción no se puede
            deshacer.
          </>
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        confirmBusy={deleteBusy}
        busyLabel="Eliminando…"
        onConfirm={() => void executeDeleteUser()}
        onCancel={() => {
          if (!deleteBusy) setDeleteDialogOpen(false);
        }}
      />
    </div>
  );
}
