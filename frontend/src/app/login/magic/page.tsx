'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { resolveApiUrl, LOGIN_PATH } from '@/lib/api';
import styles from '../login.module.css';

/**
 * Lee el token desde la query del navegador (no desde useSearchParams en el primer render).
 * En producción vimos dos POST casi simultáneos: primero ~21 chars (not_found), luego ~43 (ok);
 * useSearchParams puede devolver un valor intermedio antes de hidratar la URL completa.
 * Si hay varios `token=` en la query, se elige el valor más largo (enlace correcto).
 */
function pickMagicLinkTokenFromSearch(search: string): string | null {
  const q = search.startsWith('?') ? search : `?${search}`;
  const params = new URLSearchParams(q);
  const raw = params.getAll('token').map((t) => t.trim()).filter(Boolean);
  if (raw.length === 0) return null;
  return raw.reduce((a, b) => (a.length >= b.length ? a : b));
}

function MagicVerifyContent() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'error' | 'done'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = pickMagicLinkTokenFromSearch(window.location.search);
    if (!token) {
      setStatus('error');
      setMessage('Falta el enlace. Solicita un nuevo acceso desde la pantalla de inicio de sesión.');
      return;
    }

    let cancelled = false;
    (async () => {
      const verifyUrl = resolveApiUrl('/api/auth/magic-link/verify');
      try {
        const res = await fetch(verifyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          const msg = Array.isArray(data?.message)
            ? data.message.join(', ')
            : typeof data?.message === 'string'
              ? data.message
              : 'Enlace inválido o caducado.';
          setStatus('error');
          setMessage(msg);
          return;
        }
        if (data.accessToken) {
          localStorage.setItem('token', data.accessToken);
          setStatus('done');
          router.push('/launcher');
          router.refresh();
          return;
        }
        setStatus('error');
        setMessage('Respuesta inesperada del servidor.');
      } catch {
        if (!cancelled) {
          setStatus('error');
          setMessage('No se pudo conectar con el servidor.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (status === 'loading') {
    return (
      <main className={styles.main}>
        <section className={styles.card}>
          <p className={styles.subtitle}>Preparando acceso…</p>
        </section>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className={styles.main}>
        <section className={styles.card}>
          <h1 className={styles.title}>No se pudo iniciar sesión</h1>
          <p className={styles.subtitle}>{message}</p>
          <p style={{ marginTop: '1.5rem' }}>
            <Link href={LOGIN_PATH} className={styles.helpLink}>
              Volver al inicio de sesión
            </Link>
          </p>
        </section>
      </main>
    );
  }

  return null;
}

export default function MagicLoginPage() {
  return (
    <Suspense
      fallback={
        <main className={styles.main}>
          <section className={styles.card}>
            <p className={styles.subtitle}>Cargando…</p>
          </section>
        </main>
      }
    >
      <MagicVerifyContent />
    </Suspense>
  );
}
