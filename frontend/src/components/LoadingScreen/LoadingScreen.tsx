 'use client';

import { useEffect, useState } from 'react';
import { resolveAppearance } from '@/lib/appearance-cookie';
import styles from './LoadingScreen.module.css';

interface LoadingScreenProps {
  message?: string;
  fullPage?: boolean;
}

export function LoadingScreen({ message = 'Cargando contenido...', fullPage = true }: LoadingScreenProps) {
  const [appearance, setAppearance] = useState<'fiori' | 'microsoft'>(() => {
    if (typeof document === 'undefined') return resolveAppearance(undefined);
    return resolveAppearance(document.documentElement.getAttribute('data-appearance'));
  });
  useEffect(() => {
    const value = document.documentElement.getAttribute('data-appearance');
    setAppearance(resolveAppearance(value));
  }, []);

  const isFiori = appearance === 'fiori';

  return (
    <div className={`${styles.container} ${fullPage ? styles.fullPage : styles.inline}`} role="status" aria-live="polite">
      <div className={styles.card}>
        <div className={styles.indicatorWrap}>
          {isFiori ? (
            <span className={styles.ui5Busy}>
              <ui5-busy-indicator active delay={0} />
            </span>
          ) : (
            <span className={styles.busyIndicator} aria-hidden="true" />
          )}
        </div>
        <p className={styles.message}>{message}</p>
      </div>
    </div>
  );
}
