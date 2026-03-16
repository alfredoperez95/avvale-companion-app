'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/api';
import styles from './page.module.css';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    if (getToken()) {
      router.replace('/launcher');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <main className={styles.main}>
      <p className={styles.lead}>Redirigiendo…</p>
    </main>
  );
}
