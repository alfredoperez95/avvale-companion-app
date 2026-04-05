'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { resolveApiUrl } from '@/lib/api';
import styles from '../login.module.css';

function MagicVerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'error' | 'done'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Falta el enlace. Solicita un nuevo acceso desde la pantalla de inicio de sesión.');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(resolveApiUrl('/api/auth/magic-link/verify'), {
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
  }, [searchParams, router]);

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
            <Link href="/login" className={styles.helpLink}>
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
