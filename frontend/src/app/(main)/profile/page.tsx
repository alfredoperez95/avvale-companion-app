'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useAvatarUrl } from '@/hooks/useAvatarUrl';
import styles from './profile.module.css';

type Profile = {
  id: string;
  email: string;
  name: string | null;
  lastName: string | null;
  position: string | null;
  avatarPath?: string | null;
  appearance: string | null;
  role?: string;
  createdAt?: string;
};

const APPEARANCE_MICROSOFT = 'microsoft';
const APPEARANCE_FIORI = 'fiori';

function getInitials(name?: string | null, lastName?: string | null, email?: string): string {
  const n = (name ?? '').trim();
  const l = (lastName ?? '').trim();
  if (n && l) return `${n[0]}${l[0]}`.toUpperCase();
  if (n && n.length >= 2) return n.slice(0, 2).toUpperCase();
  if (n) return n[0].toUpperCase();
  const e = (email ?? '').trim();
  if (e.length >= 2) return e.slice(0, 2).toUpperCase();
  if (e) return e[0].toUpperCase();
  return '?';
}

export default function PerfilPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deletingAvatar, setDeletingAvatar] = useState(false);
  const [savingAppearance, setSavingAppearance] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    lastName: '',
    position: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarUrl = useAvatarUrl(profile?.avatarPath ?? null);

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then((r) => {
        if (r.status === 401) {
          window.location.href = '/login';
          return null;
        }
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (data) {
          setProfile(data);
          setForm({
            name: data.name ?? '',
            lastName: data.lastName ?? '',
            position: data.position ?? '',
          });
          if (typeof document !== 'undefined' && data.appearance != null) {
            document.documentElement.setAttribute('data-appearance', data.appearance === 'fiori' ? 'fiori' : 'microsoft');
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await apiFetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim() || undefined,
          lastName: form.lastName.trim() || undefined,
          position: form.position.trim() || undefined,
        }),
      });
      if (res.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? 'Error al guardar');
        return;
      }
      setProfile(data);
    } finally {
      setSaving(false);
    }
  };

  const currentAppearance = profile?.appearance ?? APPEARANCE_MICROSOFT;

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) {
      setError('Selecciona una imagen (JPEG, PNG, WebP o GIF).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('La imagen no puede superar 2 MB.');
      return;
    }
    setError('');
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiFetch('/api/auth/me/avatar', {
        method: 'POST',
        body: formData,
      });
      if (res.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? 'Error al subir la foto');
        return;
      }
      setProfile((prev) => (prev ? { ...prev, ...data } : data));
      if (typeof window !== 'undefined' && data.id) {
        window.dispatchEvent(new CustomEvent('user-updated', { detail: data }));
      }
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!profile?.avatarPath || deletingAvatar) return;
    setError('');
    setDeletingAvatar(true);
    try {
      const res = await apiFetch('/api/auth/me/avatar', { method: 'DELETE' });
      if (res.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? 'Error al eliminar la foto');
        return;
      }
      setProfile((prev) => (prev ? { ...prev, avatarPath: null } : prev));
      if (typeof window !== 'undefined' && data.id) {
        window.dispatchEvent(new CustomEvent('user-updated', { detail: data }));
      }
    } finally {
      setDeletingAvatar(false);
    }
  };

  const handleAppearanceSelect = async (value: string) => {
    if (value === currentAppearance || savingAppearance) return;
    setSavingAppearance(true);
    setError('');
    try {
      const res = await apiFetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appearance: value }),
      });
      if (res.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? 'Error al guardar apariencia');
        return;
      }
      setProfile(data);
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-appearance', data.appearance === 'fiori' ? 'fiori' : 'microsoft');
        window.dispatchEvent(new CustomEvent('theme-changed', { detail: { appearance: data.appearance } }));
      }
    } finally {
      setSavingAppearance(false);
    }
  };

  if (loading) return null;

  const initials = getInitials(profile?.name, profile?.lastName, profile?.email);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Mi perfil</h1>
      </header>
      <section className={styles.section} aria-labelledby="perfil-datos">
        <div className={styles.avatarBlock}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className={styles.avatarFileInput}
            aria-hidden
            onChange={handleAvatarFileChange}
          />
          <div
            className={styles.avatarWrapper}
            role="button"
            tabIndex={0}
            aria-label="Cambiar foto de perfil"
            onClick={handleAvatarClick}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleAvatarClick(); } }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className={styles.avatarImage} />
            ) : (
              <span className={styles.avatar} aria-hidden="true">
                {initials}
              </span>
            )}
            <span className={styles.avatarOverlay} aria-hidden="true">
              {uploadingAvatar ? (
                <span className={styles.avatarOverlayText}>Subiendo…</span>
              ) : (
                <>
                  <svg className={styles.avatarOverlayIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <span className={styles.avatarOverlayText}>Cambiar foto</span>
                </>
              )}
            </span>
            {avatarUrl && !uploadingAvatar && (
              <button
                type="button"
                className={styles.avatarRemoveBtn}
                onClick={handleRemoveAvatar}
                disabled={deletingAvatar}
                aria-label="Eliminar foto de perfil"
                title="Eliminar foto de perfil"
              >
                {deletingAvatar ? (
                  <span className={styles.avatarRemoveBtnText}>…</span>
                ) : (
                  <svg className={styles.avatarRemoveIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
        <h2 id="perfil-datos" className={styles.sectionTitle}>
          Datos del usuario
        </h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.nameRow}>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="name">
                Nombre
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                className={styles.input}
                placeholder="Tu nombre"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="lastName">
                Apellidos
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                value={form.lastName}
                onChange={handleChange}
                className={styles.input}
                placeholder="Tus apellidos"
              />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="text"
              value={profile?.email ?? ''}
              readOnly
              className={styles.inputReadOnly}
              aria-readonly="true"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="position">
              Puesto
            </label>
            <input
              id="position"
              name="position"
              type="text"
              value={form.position}
              onChange={handleChange}
              className={styles.input}
              placeholder="Ej. Consultor, Analista..."
            />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.actions}>
            <button type="submit" disabled={saving} className={styles.btnPrimary}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </section>

      <section className={styles.section} aria-labelledby="perfil-apariencia">
        <h2 id="perfil-apariencia" className={styles.sectionTitle}>
          Apariencia
        </h2>
        <div className={styles.appearanceGrid} role="group" aria-label="Seleccionar apariencia">
          <button
            type="button"
            className={currentAppearance === APPEARANCE_MICROSOFT ? `${styles.appearanceCard} ${styles.appearanceCardSelected}` : styles.appearanceCard}
            onClick={() => handleAppearanceSelect(APPEARANCE_MICROSOFT)}
            disabled={savingAppearance}
            aria-pressed={currentAppearance === APPEARANCE_MICROSOFT}
          >
            <span className={styles.appearanceCardTitle}>Microsoft Like</span>
            <span className={styles.appearanceCardDesc}>Estilo tipo Microsoft Portal (actual)</span>
          </button>
          <button
            type="button"
            className={currentAppearance === APPEARANCE_FIORI ? `${styles.appearanceCard} ${styles.appearanceCardSelected}` : styles.appearanceCard}
            onClick={() => handleAppearanceSelect(APPEARANCE_FIORI)}
            disabled={savingAppearance}
            aria-pressed={currentAppearance === APPEARANCE_FIORI}
          >
            <span className={styles.appearanceCardTitle}>Fiori Like</span>
            <span className={styles.appearanceCardDesc}>Estilo SAP Fiori</span>
          </button>
        </div>
        {error && <p className={styles.error}>{error}</p>}
      </section>

      {profile?.role === 'ADMIN' && (
        <section className={`${styles.section} ${styles.adminSection}`} aria-labelledby="perfil-admin">
          <h2 id="perfil-admin" className={styles.sectionTitle}>
            Administración
          </h2>
          <Link href="/admin" className={styles.adminCard}>
            <span className={styles.adminCardTitle}>Gestión de usuarios</span>
            <span className={styles.adminCardDesc}>
              Crear y gestionar usuarios, permisos y contraseñas de la aplicación.
            </span>
          </Link>
        </section>
      )}
    </div>
  );
}
