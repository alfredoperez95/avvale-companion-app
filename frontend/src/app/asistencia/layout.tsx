'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Footer } from '@/components/Footer/Footer';
import '@/styles/fonts-fiori.css';
import '@/styles/icons-fiori.css';
import styles from './layout.module.css';

export default function AsistenciaLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.setAttribute('data-appearance', 'fiori');
  }, []);

  return (
    <div className={styles.shell} data-theme="fiori">
      <header className={styles.header} role="banner">
        <div className={styles.headerInner}>
          <div className={styles.brand} aria-label="Avvale Companion App">
            <img
              src="https://www.avvale.com/hubfs/avvale-logo-hor-col-neg-1.png"
              alt="Avvale"
              className={styles.logo}
            />
            <span className={styles.appName}>Companion App · Asistencia</span>
          </div>
          <div className={styles.headerActions}>
            <Link className={styles.headerLink} href="/login">
              Iniciar sesión
            </Link>
          </div>
        </div>
      </header>
      <div className={styles.mainFooterWrap}>
        <div className={styles.main}>{children}</div>
        <Footer />
      </div>
    </div>
  );
}

