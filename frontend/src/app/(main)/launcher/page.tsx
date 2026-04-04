'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import { PageHero } from '@/components/page-hero';
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
            <h3 className={styles.welcomeBannerTitle}>Te damos la bienvenida a Avvale Companion Apps</h3>
            <p className={styles.welcomeBannerSubtitle}>
              Un ecosistema de aplicaciones internas creado para reunir en un único punto de acceso distintas soluciones desarrolladas por Avvale, orientadas a optimizar operaciones, acelerar tareas recurrentes y dar soporte a procesos de negocio y gestión interna.
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

      <PageHero title="App Launcher" subtitle="Elige una aplicación:" />
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
            <span className={styles.tileIcon} aria-hidden="true" />
          </article>
        </Link>
        <Link
          href="https://pipeline-ten-taupe.vercel.app/dashboard"
          className={styles.tileLink}
          aria-labelledby="tile-pipeline-heading"
          role="listitem"
          target="_blank"
          rel="noopener noreferrer"
        >
          <article className={styles.tile}>
            <h2 id="tile-pipeline-heading" className={styles.tileTitle}>
              Pipeline Dashboard
            </h2>
            <p className={styles.tileDesc}>
              Pipeline de ventas, métricas y análisis por equipo y fase, basado en la recopilación semanal de datos desde HubSpot.
            </p>
            <span className={styles.tileCta}>Abrir Pipeline Dashboard →</span>
            <span className={`${styles.tileIcon} ${styles.tileIconPipeline}`} aria-hidden="true" />
          </article>
        </Link>
        <Link
          href="/launcher/yubiq/approve-seal-filler"
          className={styles.tileLink}
          aria-labelledby="tile-yubiq-approve-seal-heading"
          role="listitem"
        >
          <article className={styles.tile}>
            <h2 id="tile-yubiq-approve-seal-heading" className={styles.tileTitle}>
              Yubiq Approve &amp; Seal Filler
            </h2>
            <p className={styles.tileDesc}>
              Sube una oferta comercial en PDF, analízala con IA y obtén campos estructurados (título, cliente, importe, área Avvale y resumen).
            </p>
            <span className={styles.tileCta}>Abrir módulo →</span>
            <span className={`${styles.tileIcon} ${styles.tileIconYubiq}`} aria-hidden="true" />
          </article>
        </Link>
      </div>
    </div>
  );
}
