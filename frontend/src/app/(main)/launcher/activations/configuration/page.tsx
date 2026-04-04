'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { PageBreadcrumb, PageBackLink, PageHero } from '@/components/page-hero';
import styles from './configuration.module.css';

export default function ConfigurationHubPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then((r) => {
        if (r.status === 401) {
          window.location.href = '/login';
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((user) => {
        if (user?.role === 'ADMIN') setIsAdmin(true);
      })
      .finally(() => setLoading(false))
      .catch(() => setLoading(false));
  }, []);

  if (loading) return null;

  return (
    <div className={styles.page}>
      <PageBreadcrumb>
        <PageBackLink href="/launcher/activations/dashboard">← Dashboard</PageBackLink>
      </PageBreadcrumb>
      <PageHero title="Configuración" subtitle="Elige qué quieres configurar:" />
      <div className={styles.tilesGrid} role="list">
        {isAdmin && (
          <>
            <Link href="/launcher/activations/configuration/contacts" className={styles.tileLink} aria-labelledby="tile-contacts-heading" role="listitem">
              <article className={styles.tile}>
                <h2 id="tile-contacts-heading" className={styles.tileTitle}>Contactos</h2>
                <p className={styles.tileDesc}>
                  Destinatarios en copia que aparecen como sugerencias al crear o editar una activación.
                </p>
                <span className={styles.tileCta}>Gestionar contactos →</span>
              </article>
            </Link>
            <Link href="/launcher/activations/configuration/billing-admin" className={styles.tileLink} aria-labelledby="tile-billing-heading" role="listitem">
              <article className={styles.tile}>
                <h2 id="tile-billing-heading" className={styles.tileTitle}>Facturación y Administración</h2>
                <p className={styles.tileDesc}>
                  Contactos que se incluyen siempre en todas las activaciones, de índole administrativo y/o de facturación.
                </p>
                <span className={styles.tileCta}>Gestionar contactos →</span>
              </article>
            </Link>
            <Link href="/launcher/activations/configuration/areas" className={styles.tileLink} aria-labelledby="tile-areas-heading" role="listitem">
              <article className={styles.tile}>
                <h2 id="tile-areas-heading" className={styles.tileTitle}>Áreas</h2>
                <p className={styles.tileDesc}>
                  Catálogo global de áreas, directores y subáreas; todos los usuarios lo usan al crear activaciones.
                </p>
                <span className={styles.tileCta}>Gestionar áreas →</span>
              </article>
            </Link>
          </>
        )}
        <Link href="/launcher/activations/configuration/email-templates" className={styles.tileLink} aria-labelledby="tile-templates-heading" role="listitem">
          <article className={styles.tile}>
            <h2 id="tile-templates-heading" className={styles.tileTitle}>Plantillas Email</h2>
            <p className={styles.tileDesc}>
              {isAdmin
                ? 'Plantillas de sistema: base que se clona a cada usuario al entrar por primera vez. Para el envío en activaciones cada uno usa su copia personal.'
                : 'Plantillas predefinidas para el cuerpo del correo. Crear y editar con el editor de texto enriquecido.'}
            </p>
            <span className={styles.tileCta}>Gestionar plantillas →</span>
          </article>
        </Link>
        <Link href="/launcher/activations/configuration/email-signature" className={styles.tileLink} aria-labelledby="tile-signature-heading" role="listitem">
          <article className={styles.tile}>
            <h2 id="tile-signature-heading" className={styles.tileTitle}>Firma</h2>
            <p className={styles.tileDesc}>
              Se incluye en el envío del email de activación. El administrador puede definir además la plantilla inicial para nuevas cuentas.
            </p>
            <span className={styles.tileCta}>Editar firma →</span>
          </article>
        </Link>
      </div>
    </div>
  );
}
