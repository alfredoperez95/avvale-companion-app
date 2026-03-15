'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import styles from './launcher.module.css';

export default function LauncherPage() {
  const user = useUser();
  const [bannerVisible, setBannerVisible] = useState(true);

  const displayName = user?.name?.trim() || user?.email || 'Usuario';

  return (
    <div className={styles.page}>
      <h2 className={styles.welcomeTitle}>Bienvenido {displayName}</h2>

      {bannerVisible && (
        <section className={styles.welcomeBanner} aria-label="Bienvenida a SAP for Me">
          <div className={styles.welcomeBannerOverlay}>
            <h3 className={styles.welcomeBannerTitle}>Le damos la bienvenida a SAP for Me</h3>
            <p className={styles.welcomeBannerSubtitle}>
              Recuerde que siempre puede editar sus intereses para personalizar la página de inicio.
            </p>
            <p className={styles.welcomeBannerSubtitle}>
              Pruébela y no dude en enviarnos su feedback.
            </p>
            <div className={styles.welcomeBannerActions}>
              <Link href="#" className={styles.welcomeBannerBtnPrimary} aria-label="Editar mis intereses">
                Editar mis intereses
              </Link>
              <button
                type="button"
                className={styles.welcomeBannerBtnSecondary}
                onClick={() => setBannerVisible(false)}
                aria-label="Cerrar banner"
              >
                Cerrar
              </button>
            </div>
          </div>
        </section>
      )}

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
