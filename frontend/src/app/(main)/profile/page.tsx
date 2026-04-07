'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { apiFetch, redirectToLogin } from '@/lib/api';
import { clearAppearanceCookie, resolveAppearance, setAppearanceCookie } from '@/lib/appearance-cookie';
import { useAvatarUrl } from '@/hooks/useAvatarUrl';
import { PhoneCountryPicker } from '@/components/PhoneCountryPicker/PhoneCountryPicker';
import { buildStoredPhone, parseStoredPhone } from '@/lib/phone-country-codes';
import { PageBreadcrumb, PageBackLink, PageHero, ChevronBackIcon } from '@/components/page-hero';
import { CredentialsForm } from '@/components/profile/CredentialsForm/CredentialsForm';
import { USER_INDUSTRY_OPTIONS, type UserIndustryValue } from '@/lib/user-industry';
import { getPositionOptionsForProfileEditor, type UserPositionValue } from '@/lib/user-position';
import styles from './profile.module.css';

type Profile = {
  id: string;
  email: string;
  phone?: string | null;
  name: string | null;
  lastName: string | null;
  position: string | null;
  industry?: string | null;
  avatarPath?: string | null;
  appearance: string | null;
  role?: string;
  createdAt?: string;
  growthManagingDirectorUserId?: string | null;
};

const APPEARANCE_MICROSOFT = 'microsoft';
const APPEARANCE_FIORI = 'fiori';

/** Si es true, la tarjeta «Microsoft Like» no es seleccionable. Pasa a false para rehabilitarla. */
const APPEARANCE_MICROSOFT_OPTION_DISABLED = true;

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
  const [form, setForm] = useState<{
    name: string;
    lastName: string;
    position: '' | UserPositionValue;
    industry: '' | UserIndustryValue;
    phoneCountryIso: string;
    phoneNational: string;
  }>({
    name: '',
    lastName: '',
    position: '',
    industry: '',
    phoneCountryIso: 'ES',
    phoneNational: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarUrl = useAvatarUrl(profile?.avatarPath ?? null);

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then((r) => {
        if (r.status === 401) {
          redirectToLogin();
          return null;
        }
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (data) {
          setProfile(data);
          const parsed = parseStoredPhone(data.phone);
          setForm({
            name: data.name ?? '',
            lastName: data.lastName ?? '',
            position: (data.position as UserPositionValue | null | undefined) ?? '',
            industry: (data.industry as UserIndustryValue | null | undefined) ?? '',
            phoneCountryIso: parsed.iso,
            phoneNational: parsed.national,
          });
          if (typeof document !== 'undefined') {
            const appearanceValue = resolveAppearance(data.appearance);
            document.documentElement.setAttribute('data-appearance', appearanceValue);
            setAppearanceCookie(appearanceValue);
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const name = form.name.trim();
    const lastName = form.lastName.trim();
    if (!name || !lastName || !form.position) {
      setError('Nombre, apellido y puesto son obligatorios.');
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          lastName,
          position: form.position,
          industry: form.industry === '' ? null : form.industry,
          phone: buildStoredPhone(form.phoneCountryIso, form.phoneNational),
        }),
      });
      if (res.status === 401) {
        localStorage.removeItem('token');
        clearAppearanceCookie();
        redirectToLogin();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? 'Error al guardar');
        return;
      }
      setProfile(data);
      const parsed = parseStoredPhone(data.phone);
      setForm((f) => ({
        ...f,
        name: data.name ?? '',
        lastName: data.lastName ?? '',
        position: (data.position as UserPositionValue | null | undefined) ?? '',
        industry: (data.industry as UserIndustryValue | null | undefined) ?? '',
        phoneCountryIso: parsed.iso,
        phoneNational: parsed.national,
      }));
    } finally {
      setSaving(false);
    }
  };

  const currentAppearance = resolveAppearance(profile?.appearance);

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
        clearAppearanceCookie();
        redirectToLogin();
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
        clearAppearanceCookie();
        redirectToLogin();
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
        clearAppearanceCookie();
        redirectToLogin();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? 'Error al guardar apariencia');
        return;
      }
      setProfile(data);
      if (typeof document !== 'undefined') {
        const appearanceValue = resolveAppearance(data.appearance);
        document.documentElement.setAttribute('data-appearance', appearanceValue);
        setAppearanceCookie(appearanceValue);
        window.dispatchEvent(new CustomEvent('theme-changed', { detail: { appearance: data.appearance } }));
      }
    } finally {
      setSavingAppearance(false);
    }
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
          <span>Cargando perfil…</span>
        </div>
      </div>
    );
  }

  const initials = getInitials(profile?.name, profile?.lastName, profile?.email);

  return (
    <div className={styles.page}>
      <PageBreadcrumb>
        <PageBackLink href="/launcher/activations/dashboard">
          <ChevronBackIcon />
          Dashboard
        </PageBackLink>
      </PageBreadcrumb>
      <PageHero
        title="Mi perfil"
        subtitle="Datos de cuenta, apariencia de la aplicación y credenciales de IA (Anthropic) en un solo lugar."
      />
      {error ? (
        <div className={styles.errorBanner} role="alert">
          {error}
        </div>
      ) : null}

      <section className={styles.card} aria-labelledby="perfil-datos">
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
        <h2 id="perfil-datos" className={styles.cardTitle}>
          Datos del usuario
        </h2>
        <p className={styles.cardDesc}>
          Nombre, contacto y puesto. El correo lo asigna un administrador; aquí solo se muestra.
        </p>
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
                required
                placeholder="Nombre"
                autoComplete="given-name"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="lastName">
                Apellido
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                value={form.lastName}
                onChange={handleChange}
                className={styles.input}
                required
                placeholder="Apellido"
                autoComplete="family-name"
              />
            </div>
          </div>
          <div className={styles.nameRow}>
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
              <span className={styles.label} id="phone-label">
                Teléfono
              </span>
              <div className={styles.phoneRow} role="group" aria-labelledby="phone-label">
                <PhoneCountryPicker
                  value={form.phoneCountryIso}
                  onChange={(iso) => {
                    setForm((prev) => ({ ...prev, phoneCountryIso: iso }));
                    setError('');
                  }}
                  aria-label="Prefijo internacional"
                />
                <input
                  id="phone-national"
                  name="phoneNational"
                  type="tel"
                  inputMode="tel"
                  value={form.phoneNational}
                  onChange={handleChange}
                  className={`${styles.input} ${styles.phoneNationalInput}`}
                  placeholder="600 000 000"
                  autoComplete="tel-national"
                  aria-label="Número de teléfono (sin prefijo)"
                />
              </div>
            </div>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="position">
              Puesto
            </label>
            <select
              id="position"
              name="position"
              value={form.position}
              onChange={handleChange}
              className={styles.select}
              required
              aria-label="Puesto"
            >
              <option value="">Seleccionar…</option>
              {getPositionOptionsForProfileEditor(
                profile?.id ?? '',
                profile?.growthManagingDirectorUserId,
              ).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="industry">
              Industria
            </label>
            <select
              id="industry"
              name="industry"
              value={form.industry}
              onChange={handleChange}
              className={styles.select}
              aria-label="Industria o sector"
            >
              <option value="">Seleccionar…</option>
              {USER_INDUSTRY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.actions}>
            <button type="submit" disabled={saving} className={styles.btnPrimary}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </section>

      <section className={styles.card} aria-labelledby="perfil-apariencia">
        <h2 id="perfil-apariencia" className={styles.cardTitle}>
          Apariencia
        </h2>
        <p className={styles.cardDesc}>
          Elige el tema visual de la aplicación. El cambio se aplica al instante en este dispositivo.
        </p>
        <div className={styles.appearanceGrid} role="group" aria-label="Seleccionar apariencia">
          <button
            type="button"
            className={currentAppearance === APPEARANCE_MICROSOFT ? `${styles.appearanceCard} ${styles.appearanceCardSelected}` : styles.appearanceCard}
            onClick={() => handleAppearanceSelect(APPEARANCE_MICROSOFT)}
            disabled={savingAppearance || APPEARANCE_MICROSOFT_OPTION_DISABLED}
            aria-pressed={currentAppearance === APPEARANCE_MICROSOFT}
            title={
              APPEARANCE_MICROSOFT_OPTION_DISABLED
                ? 'De momento no está disponible volver a este tema.'
                : undefined
            }
          >
            <span className={styles.appearanceCardTitle}>Microsoft Like</span>
            <span className={styles.appearanceCardDesc}>Estilo tipo Microsoft Portal (actual)</span>
            {APPEARANCE_MICROSOFT_OPTION_DISABLED ? (
              <span className={styles.appearanceCardHint}>No disponible de momento.</span>
            ) : null}
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
      </section>

      <section className={styles.card} aria-labelledby="perfil-ai-credentials">
        <h2 id="perfil-ai-credentials" className={styles.cardTitle}>
          AI Credentials
        </h2>
        <CredentialsForm embedded />
      </section>

      {profile?.role === 'ADMIN' && (
        <section className={`${styles.card} ${styles.adminSection}`} aria-labelledby="perfil-admin">
          <h2 id="perfil-admin" className={styles.cardTitle}>
            Administración
          </h2>
          <p className={styles.cardDesc}>Acceso rápido a la gestión de usuarios del sistema.</p>
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
