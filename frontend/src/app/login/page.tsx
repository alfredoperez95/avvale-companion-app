'use client';

/**
 * Pantalla de inicio de sesión — entrada pública canónica.
 * @see docs/LOGIN_STANDARD.md
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { resolveApiUrl } from '@/lib/api';
import { getAppearanceFromCookie, setAppearanceCookie } from '@/lib/appearance-cookie';
import styles from './login.module.css';

type Appearance = 'microsoft' | 'fiori';

const CORP_EMAIL_DOMAIN = '@avvale.com';

/** Tras solicitar el enlace mágico, no permitir otra petición hasta pasados estos segundos (cliente). El backend sigue con su propio rate limit. */
const MAGIC_LINK_COOLDOWN_SEC = 30;

function parseEmailLocalPart(raw: string): string {
  let t = raw.trim();
  const suffix = '@avvale.com';
  const lower = t.toLowerCase();
  if (lower.endsWith(suffix)) {
    return t.slice(0, -suffix.length).trim();
  }
  const at = t.indexOf('@');
  if (at !== -1) {
    return t.slice(0, at).trim();
  }
  return t;
}

function buildCorporateEmail(localPart: string): string {
  return `${localPart.trim()}${CORP_EMAIL_DOMAIN}`;
}

export default function LoginPage() {
  const router = useRouter();
  const [emailLocal, setEmailLocal] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [brandingReady, setBrandingReady] = useState(false);
  const [appearance, setAppearance] = useState<Appearance>(() => getAppearanceFromCookie() ?? 'microsoft');
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicError, setMagicError] = useState('');
  const [magicSuccess, setMagicSuccess] = useState('');
  /** Por defecto acceso por enlace; al activar, se muestran contraseña y Continuar */
  const [showPasswordPath, setShowPasswordPath] = useState(false);
  const [magicCooldownSec, setMagicCooldownSec] = useState(0);

  useEffect(() => {
    if (magicCooldownSec <= 0) return;
    const t = setTimeout(() => setMagicCooldownSec((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [magicCooldownSec]);

  useEffect(() => {
    let mounted = true;
    const applyAppearance = (value: Appearance) => {
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-appearance', value);
        setAppearanceCookie(value);
      }
    };

    const brandingUrl = resolveApiUrl('/api/auth/branding');
    if (process.env.NODE_ENV === 'development') {
      console.info('[login] Branding URL:', brandingUrl);
    }
    fetch(brandingUrl)
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as { appearance?: string };
      })
      .then((data) => {
        if (!mounted) return;
        const nextAppearance: Appearance = data?.appearance === 'fiori' ? 'fiori' : 'microsoft';
        setAppearance(nextAppearance);
        applyAppearance(nextAppearance);
      })
      .catch(() => {
        if (!mounted) return;
        setAppearance('microsoft');
        applyAppearance('microsoft');
      })
      .finally(() => {
        if (mounted) setBrandingReady(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const runPasswordLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const loginUrl = resolveApiUrl('/api/auth/login');
      if (process.env.NODE_ENV === 'development') {
        console.info('[login] Login URL:', loginUrl);
      }
      const res = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: buildCorporateEmail(emailLocal), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (process.env.NODE_ENV === 'development') {
        console.info('[login] Login response:', res.status, data);
      }
      if (!res.ok) {
        const msg =
          typeof data?.message === 'string' && data.message.length > 0
            ? data.message
            : `Error al iniciar sesión (HTTP ${res.status})`;
        setError(msg);
        return;
      }
      if (data.accessToken) {
        typeof window !== 'undefined' && localStorage.setItem('token', data.accessToken);
        router.push('/launcher');
        router.refresh();
      }
    } catch (err) {
      setError('No se pudo conectar con el servidor. Comprueba que el backend esté en marcha y que NEXT_PUBLIC_API_URL sea correcto.');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (showPasswordPath) {
      await runPasswordLogin();
      return;
    }
    await handleMagicLink();
  };

  const handleMagicLink = async () => {
    setMagicError('');
    setMagicSuccess('');
    const trimmed = emailLocal.trim();
    if (!trimmed) {
      setMagicError('Indica tu usuario corporativo (nombre.apellido) arriba.');
      return;
    }
    setMagicLoading(true);
    setMagicCooldownSec(MAGIC_LINK_COOLDOWN_SEC);
    try {
      const url = resolveApiUrl('/api/auth/magic-link/request');
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: buildCorporateEmail(trimmed) }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setMagicError('Demasiados intentos. Espera un minuto e inténtalo de nuevo.');
        return;
      }
      if (!res.ok) {
        setMagicError('No se pudo enviar el enlace. Comprueba la conexión o inténtalo más tarde.');
        return;
      }
      const msg =
        typeof data?.message === 'string' && data.message.length > 0
          ? data.message
          : 'Si existe una cuenta con ese correo y estás registrado en la plataforma, recibirás un enlace para iniciar sesión.';
      setMagicSuccess(msg);
    } catch {
      setMagicError('No se pudo conectar con el servidor.');
    } finally {
      setMagicLoading(false);
    }
  };

  return (
    <main className={styles.main} data-theme={appearance}>
      <section className={styles.card} aria-busy={!brandingReady}>
        <header className={styles.header}>
          <div className={styles.brandRow}>
            <p className={styles.brandKicker}>{appearance === 'fiori' ? 'SAP ID' : 'AVVALE ID®'}</p>
            <img
              src="https://www.sap.com/dam/application/shared/logos/customer/a-g/avvale-customer-logo.png"
              alt="Avvale"
              className={styles.brandLogo}
            />
          </div>
          <h1 className={styles.title}>Iniciar sesión</h1>
          <p className={styles.subtitle}>
            {appearance === 'fiori' ? 'SAP for Me' : 'Accede con tu cuenta corporativa'}
          </p>
        </header>

        <form onSubmit={handleFormSubmit} className={styles.form} autoComplete="off">
          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>
              Email corporativo
            </label>
            <div className={styles.emailComposite}>
              <input
                id="email"
                name="email-local"
                type="text"
                inputMode="email"
                autoComplete="off"
                autoFocus
                value={emailLocal}
                onChange={(e) => setEmailLocal(parseEmailLocalPart(e.target.value))}
                required
                className={`${styles.input} ${styles.emailLocal}`}
                placeholder="nombre.apellido"
                spellCheck={false}
                aria-describedby="email-domain-hint"
              />
              <span className={styles.emailSep} aria-hidden="true" />
              <span id="email-domain-hint" className={styles.emailDomainBadge}>
                {CORP_EMAIL_DOMAIN}
              </span>
            </div>
          </div>

          <div className={styles.pathToggleRow}>
            <button
              type="button"
              className={styles.pathToggle}
              onClick={() => {
                setShowPasswordPath((v) => !v);
                setError('');
                setMagicError('');
                if (showPasswordPath) {
                  setMagicSuccess('');
                }
              }}
            >
              {showPasswordPath ? 'Volver al acceso por enlace' : '¿Quieres acceder con contraseña?'}
            </button>
          </div>

          <div className={styles.formMain}>
            {!showPasswordPath ? (
              <div className={styles.magicBlock}>
                <p className={styles.magicLead} aria-live="polite">
                  Te enviamos un enlace seguro para acceder sin contraseña a:
                  <span className={styles.magicLeadEmailLine}>
                    {emailLocal.trim() ? (
                      <b className={styles.magicLeadStrong}>{buildCorporateEmail(emailLocal.trim())}</b>
                    ) : (
                      <b className={styles.magicLeadPlaceholder}>email corporativo</b>
                    )}
                  </span>
                </p>
                {magicError ? <p className={styles.error}>{magicError}</p> : null}
                {magicSuccess ? <p className={styles.magicSuccess}>{magicSuccess}</p> : null}
              </div>
            ) : (
              <div className={styles.passwordSection}>
                <div className={styles.formGroup}>
                  <label htmlFor="password" className={styles.label}>
                    Contraseña
                  </label>
                  <div className={styles.passwordWrap}>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required={showPasswordPath}
                      className={styles.input}
                      placeholder="Contraseña"
                      autoComplete="current-password"
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
                <div className={styles.actionsRow}>
                  <label className={styles.checkboxRow}>
                    <input type="checkbox" className={styles.checkbox} />
                    <span>Mantener inicio de sesión</span>
                  </label>
                  <a href="#" className={styles.helpLink}>
                    ¿Ha olvidado la contraseña?
                  </a>
                </div>
                {error ? <p className={styles.error}>{error}</p> : null}
              </div>
            )}
          </div>

          <footer className={styles.footerBar}>
            {!showPasswordPath ? (
              <button
                type="submit"
                disabled={magicLoading || !brandingReady || magicCooldownSec > 0}
                className={styles.submit}
              >
                {magicLoading
                  ? 'Enviando…'
                  : magicCooldownSec > 0
                    ? `Espera ${magicCooldownSec}s para reenviar`
                    : 'Enviar enlace de acceso'}
              </button>
            ) : (
              <button type="submit" disabled={loading || !brandingReady} className={styles.submit}>
                {loading ? 'Entrando…' : 'Continuar'}
              </button>
            )}
          </footer>
        </form>
      </section>
    </main>
  );
}
