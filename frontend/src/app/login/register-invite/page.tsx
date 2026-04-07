'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { getPositionOptionsForProfileEditor, type UserPositionValue } from '@/lib/user-position';
import { USER_INDUSTRY_OPTIONS, type UserIndustryValue } from '@/lib/user-industry';
import styles from '../login.module.css';

type Preview = {
  email: string;
  name: string;
  lastName: string;
  position: string | null;
  industry: string | null;
  role: string;
  needsPosition: boolean;
  needsIndustry: boolean;
  growthManagingDirectorUserId: string | null;
};

function InviteCardHeader({ subtitleOverride }: { subtitleOverride?: string }) {
  return (
    <header className={styles.header}>
      <div className={styles.brandRow}>
        <p className={styles.brandKicker}>AVVALE ID®</p>
        <img
          src="https://www.sap.com/dam/application/shared/logos/customer/a-g/avvale-customer-logo.png"
          alt="Avvale"
          className={styles.brandLogo}
        />
      </div>
      <h1 className={styles.title}>Completar registro</h1>
      <p className={styles.subtitle}>{subtitleOverride ?? 'Accede con tu cuenta corporativa'}</p>
    </header>
  );
}

function RegisterInviteInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadError, setLoadError] = useState('');

  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [position, setPosition] = useState<'' | UserPositionValue>('');
  const [industry, setIndustry] = useState<'' | UserIndustryValue>('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoadError('Falta el enlace de invitación. Abre el enlace del correo.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch(
          `/api/auth/invitations/preview?token=${encodeURIComponent(token)}`,
        );
        if (!res.ok) {
          if (!cancelled) {
            setLoadError('Invitación no válida o caducada. Pide una nueva al administrador.');
          }
          return;
        }
        const data = (await res.json()) as Preview;
        if (!cancelled) {
          setPreview(data);
          if (data.position) setPosition(data.position as UserPositionValue);
          if (data.industry) setIndustry(data.industry as UserIndustryValue);
        }
      } catch {
        if (!cancelled) setLoadError('Error de red al cargar la invitación.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (!token) return;
    if (password.length < 6) {
      setSubmitError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== password2) {
      setSubmitError('Las contraseñas no coinciden.');
      return;
    }
    if (preview?.needsPosition && !position) {
      setSubmitError('Selecciona un puesto.');
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, string> = { token, password };
      if (preview?.needsPosition && position) body.position = position;
      if (industry) body.industry = industry;

      const res = await apiFetch('/api/auth/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(
          typeof data.message === 'string' ? data.message : 'No se pudo completar el registro.',
        );
        return;
      }
      if (data.accessToken && typeof window !== 'undefined') {
        localStorage.setItem('token', data.accessToken);
      }
      router.replace('/launcher');
    } catch {
      setSubmitError('Error de red.');
    } finally {
      setSubmitting(false);
    }
  };

  const positionOptions = preview?.needsPosition
    ? getPositionOptionsForProfileEditor('', preview.growthManagingDirectorUserId)
    : [];

  if (loading) {
    return (
      <main className={styles.main} data-theme="microsoft">
        <section className={styles.card} aria-busy={loading}>
          <InviteCardHeader subtitleOverride="Cargando invitación…" />
        </section>
      </main>
    );
  }

  if (loadError || !preview) {
    return (
      <main className={styles.main} data-theme="microsoft">
        <section className={styles.card} aria-busy={false}>
          <InviteCardHeader />
          <div className={styles.formMain}>
            <p className={styles.error} role="alert">
              {loadError || 'No se pudo cargar la invitación.'}
            </p>
          </div>
          <p className={styles.registerBackLink}>
            <a href="/login" className={styles.helpLink}>
              Volver al inicio de sesión
            </a>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.main} data-theme="microsoft">
      <section className={styles.card} aria-busy={false}>
        <InviteCardHeader />

        <form onSubmit={handleSubmit} className={styles.form} autoComplete="off">
          <div className={styles.formMain}>
            <div className={styles.magicBlock}>
              <p className={styles.magicLead} aria-live="polite">
                Hola{' '}
                <span className={styles.magicLeadStrong}>
                  {preview.name} {preview.lastName}
                </span>
                . Completa tu acceso con una contraseña
                {preview.needsPosition || preview.needsIndustry
                  ? ' y los datos pendientes'
                  : ''}{' '}
                para el correo:
                <span className={styles.magicLeadEmailLine}>
                  <b className={styles.magicLeadStrong}>{preview.email}</b>
                </span>
              </p>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="reg-pw">
                Contraseña
              </label>
              <div className={styles.passwordWrap}>
                <input
                  id="reg-pw"
                  type={showPassword ? 'text' : 'password'}
                  className={styles.input}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  placeholder="Contraseña"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className={styles.passwordToggle}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.eyeIcon}>
                    <path d="M12 5C6.6 5 2.2 9.2 1 12c1.2 2.8 5.6 7 11 7s9.8-4.2 11-7c-1.2-2.8-5.6-7-11-7Zm0 11c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4Zm0-6.2a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Z" />
                  </svg>
                </button>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="reg-pw2">
                Repetir contraseña
              </label>
              <div className={styles.passwordWrap}>
                <input
                  id="reg-pw2"
                  type={showPassword2 ? 'text' : 'password'}
                  className={styles.input}
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  placeholder="Repite la contraseña"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword2((prev) => !prev)}
                  className={styles.passwordToggle}
                  aria-label={showPassword2 ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  title={showPassword2 ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.eyeIcon}>
                    <path d="M12 5C6.6 5 2.2 9.2 1 12c1.2 2.8 5.6 7 11 7s9.8-4.2 11-7c-1.2-2.8-5.6-7-11-7Zm0 11c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4Zm0-6.2a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Z" />
                  </svg>
                </button>
              </div>
            </div>

            {preview.needsPosition ? (
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="reg-position">
                  Puesto
                </label>
                <select
                  id="reg-position"
                  className={`${styles.input} ${styles.selectNative}`}
                  value={position}
                  onChange={(e) => setPosition((e.target.value || '') as '' | UserPositionValue)}
                  required
                >
                  <option value="">Seleccionar…</option>
                  {positionOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {preview.needsIndustry ? (
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="reg-industry">
                  Industria (opcional)
                </label>
                <select
                  id="reg-industry"
                  className={`${styles.input} ${styles.selectNative}`}
                  value={industry}
                  onChange={(e) => setIndustry((e.target.value || '') as '' | UserIndustryValue)}
                >
                  <option value="">— Opcional —</option>
                  {USER_INDUSTRY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {submitError ? (
              <p className={styles.error} role="alert">
                {submitError}
              </p>
            ) : null}
          </div>

          <footer className={styles.footerBar}>
            <button type="submit" disabled={submitting} className={styles.submit}>
              {submitting ? 'Creando cuenta…' : 'Continuar'}
            </button>
          </footer>

          <p className={styles.registerBackLink}>
            <a href="/login" className={styles.helpLink}>
              Volver al inicio de sesión
            </a>
          </p>
        </form>
      </section>
    </main>
  );
}

export default function RegisterInvitePage() {
  return (
    <Suspense
      fallback={
        <main className={styles.main} data-theme="microsoft">
          <section className={styles.card} aria-busy>
            <InviteCardHeader subtitleOverride="Cargando…" />
          </section>
        </main>
      }
    >
      <RegisterInviteInner />
    </Suspense>
  );
}
