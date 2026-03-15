'use client';

import Link from 'next/link';
import styles from './launcher.module.css';

export default function LauncherPage() {
  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>App Launcher</h1>
      <p className={styles.menuDesc}>Elige una aplicación:</p>
      <div className={styles.tilesGrid} role="list">
        <Link
          href="/launcher/activations/dashboard"
          className={styles.tileLink}
          aria-labelledby="tile-activations-heading"
          role="listitem"
        >
          <article className={styles.tile}>
            <h2 id="tile-activations-heading" className={styles.tileTitle}>
              Activaciones
            </h2>
            <p className={styles.tileDesc}>
              Dashboard, mis activaciones, nueva activación y toda la gestión de activaciones por email.
            </p>
            <span className={styles.tileCta}>Abrir Activaciones →</span>
          </article>
        </Link>
      </div>
    </div>
  );
}
