'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAppearanceFromCookie, setAppearanceCookie } from '@/lib/appearance-cookie';
import styles from './login.module.css';

type Appearance = 'microsoft' | 'fiori';

const getApiBase = () =>
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000')
    : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000');

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [brandingReady, setBrandingReady] = useState(false);
  const [appearance, setAppearance] = useState<Appearance>(() => getAppearanceFromCookie() ?? 'microsoft');

  const apiBase = useMemo(() => getApiBase(), []);

  useEffect(() => {
    let mounted = true;
    const applyAppearance = (value: Appearance) => {
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-appearance', value);
        setAppearanceCookie(value);
      }
    };

    fetch(`${apiBase}/api/auth/branding`)
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
  }, [apiBase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? 'Error al iniciar sesión');
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

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>
              Correo electrónico o nombre de usuario
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={styles.input}
              placeholder="Correo electrónico o nombre de usuario"
            />
          </div>
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
                required
                className={styles.input}
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
          <div className={styles.actionsRow}>
            <label className={styles.checkboxRow}>
              <input type="checkbox" className={styles.checkbox} />
              <span>Mantener inicio de sesión</span>
            </label>
            <a href="#" className={styles.helpLink}>
              ¿Ha olvidado la contraseña?
            </a>
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <footer className={styles.footerBar}>
            <button type="submit" disabled={loading || !brandingReady} className={styles.submit}>
              {loading ? 'Entrando…' : 'Continuar'}
            </button>
          </footer>
        </form>
      </section>
    </main>
  );
}
