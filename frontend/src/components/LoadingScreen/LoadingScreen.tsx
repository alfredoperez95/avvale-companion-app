 'use client';

import { useEffect, useState } from 'react';
import styles from './LoadingScreen.module.css';
import { Ui5BusyIndicator } from './Ui5BusyIndicator';

interface LoadingScreenProps {
  message?: string;
  fullPage?: boolean;
}

export function LoadingScreen({ message = 'Cargando contenido...', fullPage = true }: LoadingScreenProps) {
  const [appearance, setAppearance] = useState<'fiori' | 'microsoft'>('microsoft');

  useEffect(() => {
    const value = document.documentElement.getAttribute('data-appearance');
    setAppearance(value === 'fiori' ? 'fiori' : 'microsoft');
  }, []);

  const isFiori = appearance === 'fiori';

  return (
    <div className={`${styles.container} ${fullPage ? styles.fullPage : styles.inline}`} role="status" aria-live="polite">
      <div className={styles.card}>
        <div className={styles.indicatorWrap}>
          {isFiori ? (
            <span className={styles.ui5Busy}>
              <Ui5BusyIndicator active />
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
