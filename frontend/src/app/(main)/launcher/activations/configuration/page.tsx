'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import styles from './configuration.module.css';

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

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
        if (user?.role !== 'ADMIN') setForbidden(true);
      })
      .finally(() => setLoading(false))
      .catch(() => setLoading(false));
  }, []);

  if (loading) return null;

  if (forbidden) {
    return (
      <div className={styles.page}>
        <Link href="/launcher" className={styles.back}>← Inicio</Link>
        <p className={styles.forbidden}>No tienes permisos para acceder a esta sección.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link href="/launcher" className={styles.back}>← Inicio</Link>
      <h1 className={styles.h1}>Configuración</h1>
      <p className={styles.menuDesc}>Elige qué quieres configurar:</p>
      <div className={styles.tilesGrid} role="list">
        <Link href="/launcher/activations/configuration/contacts" className={styles.tileLink} aria-labelledby="tile-contacts-heading" role="listitem">
          <article className={styles.tile}>
            <h2 id="tile-contacts-heading" className={styles.tileTitle}>Contactos</h2>
            <p className={styles.tileDesc}>
              Destinatarios en copia que aparecen como sugerencias al crear o editar una activación.
            </p>
            <span className={styles.tileCta}>Gestionar contactos →</span>
          </article>
        </Link>
        <Link href="/launcher/activations/configuration/areas" className={styles.tileLink} aria-labelledby="tile-areas-heading" role="listitem">
          <article className={styles.tile}>
            <h2 id="tile-areas-heading" className={styles.tileTitle}>Áreas</h2>
            <p className={styles.tileDesc}>
              Áreas, directores y subáreas que definen los destinatarios de cada activación.
            </p>
            <span className={styles.tileCta}>Gestionar áreas →</span>
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
        <Link href="/launcher/activations/configuration/email-templates" className={styles.tileLink} aria-labelledby="tile-templates-heading" role="listitem">
          <article className={styles.tile}>
            <h2 id="tile-templates-heading" className={styles.tileTitle}>Plantillas Email</h2>
            <p className={styles.tileDesc}>
              Plantillas predefinidas para el cuerpo del correo. Crear y editar con el editor de texto enriquecido.
            </p>
            <span className={styles.tileCta}>Gestionar plantillas →</span>
          </article>
        </Link>
        <Link href="/launcher/activations/configuration/email-signature" className={styles.tileLink} aria-labelledby="tile-signature-heading" role="listitem">
          <article className={styles.tile}>
            <h2 id="tile-signature-heading" className={styles.tileTitle}>Firma</h2>
            <p className={styles.tileDesc}>
              Firma HTML que se incluye en el envío hacia Make para añadirla al correo (una sola firma global).
            </p>
            <span className={styles.tileCta}>Editar firma →</span>
          </article>
        </Link>
      </div>
    </div>
  );
}
