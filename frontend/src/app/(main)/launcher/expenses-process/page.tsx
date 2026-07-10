'use client';

import Link from 'next/link';
import { PageBreadcrumb, PageBackLink, PageHero } from '@/components/page-hero';
import styles from './expenses-process.module.css';

export default function AdministrativeProcessesPage() {
  return (
    <div className={styles.page}>
      <div className={styles.pageIntro}>
        <PageBreadcrumb>
          <PageBackLink href="/launcher">← App Launcher</PageBackLink>
        </PageBreadcrumb>
        <PageHero
          animateEnter={false}
          title="Gastos"
          subtitle="Gestión de recibos y gastos integrada en la experiencia Fiori Launchpad."
        />
      </div>

      <ul className={styles.tilesGrid}>
        <li>
          <Link
            href="/launcher/expenses-process/expenses"
            className={styles.tileLink}
            aria-labelledby="tile-expenses-heading"
          >
            <article className={styles.tile}>
              <h2 id="tile-expenses-heading" className={styles.tileTitle}>
                Gastos
              </h2>
              <p className={styles.tileDesc}>
                Sube recibos desde cámara o archivo, extrae importe, tipo y fecha con IA, revisa los datos y guarda el gasto.
              </p>
              <span className={styles.tileCta}>Abrir Gastos →</span>
            </article>
          </Link>
        </li>
        <li>
          <Link
            href="/launcher/expenses-process/email"
            className={styles.tileLink}
            aria-labelledby="tile-expenses-email-heading"
          >
            <article className={styles.tile}>
              <h2 id="tile-expenses-email-heading" className={styles.tileTitle}>
                Gastos por email
              </h2>
              <p className={styles.tileDesc}>
                Configura Make para reenviar recibos por correo al webhook y crear gastos en background, uno por adjunto válido.
              </p>
              <span className={styles.tileCta}>Configurar webhook →</span>
            </article>
          </Link>
        </li>
      </ul>
    </div>
  );
}
