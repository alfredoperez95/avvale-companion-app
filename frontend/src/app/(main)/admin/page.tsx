'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import styles from './admin.module.css';

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

  if (loading) {
    return (
      <div className={styles.page}>
        <p className={styles.forbidden}>Cargando…</p>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className={styles.page}>
        <Link href="/dashboard" className={styles.back}>← Inicio</Link>
        <p className={styles.forbidden}>No tienes permisos para acceder a esta sección.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link href="/dashboard" className={styles.back}>← Inicio</Link>
      <h1 className={styles.h1}>Configuración</h1>
      <p className={styles.menuDesc}>Elige qué quieres configurar:</p>
      <div className={styles.tilesGrid} role="list">
        <Link href="/admin/contacts" className={styles.tileLink} aria-labelledby="tile-contacts-heading" role="listitem">
          <article className={styles.tile}>
            <h2 id="tile-contacts-heading" className={styles.tileTitle}>Contactos</h2>
            <p className={styles.tileDesc}>
              Destinatarios en copia que aparecen como sugerencias al crear o editar una activación.
            </p>
            <span className={styles.tileCta}>Gestionar contactos →</span>
          </article>
        </Link>
        <Link href="/admin/areas" className={styles.tileLink} aria-labelledby="tile-areas-heading" role="listitem">
          <article className={styles.tile}>
            <h2 id="tile-areas-heading" className={styles.tileTitle}>Áreas</h2>
            <p className={styles.tileDesc}>
              Áreas, directores y subáreas que definen los destinatarios de cada activación.
            </p>
            <span className={styles.tileCta}>Gestionar áreas →</span>
          </article>
        </Link>
        <Link href="/admin/email-templates" className={styles.tileLink} aria-labelledby="tile-templates-heading" role="listitem">
          <article className={styles.tile}>
            <h2 id="tile-templates-heading" className={styles.tileTitle}>Plantillas Email</h2>
            <p className={styles.tileDesc}>
              Plantillas predefinidas para el cuerpo del correo. Crear y editar con el editor de texto enriquecido.
            </p>
            <span className={styles.tileCta}>Gestionar plantillas →</span>
          </article>
        </Link>
      </div>
    </div>
  );
}
