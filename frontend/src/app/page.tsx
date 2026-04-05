'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, LOGIN_PATH } from '@/lib/api';
import styles from './page.module.css';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    if (getToken()) {
      router.replace('/launcher');
    } else {
      router.replace(LOGIN_PATH);
    }
  }, [router]);

  return (
    <main className={styles.main}>
      <p className={styles.lead}>Redirigiendo…</p>
    </main>
  );
}
