'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { PageBreadcrumb, PageHero, PageBackLink, ChevronBackIcon } from '@/components/page-hero';
import { RfqStatusTag } from '@/components/RfqStatusTag/RfqStatusTag';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import styles from './rfq-analysis.module.css';

type Item = {
  id: string;
  title: string;
  status: string;
  sourceType: string;
  createdAt: string;
  originSubject: string | null;
  originEmail: string | null;
};

function formatCreatedAt(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function RfqAnalysisListPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Item | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch('/api/rfq-analyses');
        if (!res.ok) {
          setError('No se pudo cargar el listado');
          return;
        }
        const data = (await res.json()) as { items: Item[]; total: number };
        if (!cancelled) {
          setItems(data.items ?? []);
          setTotal(data.total ?? 0);
        }
      } catch {
        if (!cancelled) setError('Error de red');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleteBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/rfq-analyses/${toDelete.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'No se pudo eliminar el análisis');
      }
      setItems((prev) => prev.filter((x) => x.id !== toDelete.id));
      setTotal((n) => Math.max(0, n - 1));
      setToDelete(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar');
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <main className={styles.page}>
      <PageBreadcrumb>
        <PageBackLink href="/launcher">
          <ChevronBackIcon />
          App Launcher
        </PageBackLink>
      </PageBreadcrumb>
      <PageHero
        title="Análisis RFQs"
        subtitle="Un workspace por oportunidad: fuentes, resultado estructurado con IA y conversación sobre el mismo contexto."
        actions={
          <div className={styles.toolbar}>
            <Link href="/launcher/rfq-analysis/email" className={styles.secondaryBtn}>
              Entrada por email
            </Link>
            <Link href="/launcher/rfq-analysis/new" className={styles.primaryBtn}>
              Nuevo análisis
            </Link>
            {!loading ? (
              <span className={styles.toolbarCount}>
                {total === 1 ? '1 análisis' : `${total} análisis`}
              </span>
            ) : null}
          </div>
        }
      />

      {loading ? (
        <div
          className={styles.loadingSkeleton}
          aria-busy="true"
          aria-live="polite"
          aria-label="Cargando listado de análisis"
        >
          {[0, 1, 2].map((i) => (
            <div key={i} className={styles.skeletonCard}>
              <div className={styles.skeletonLine} style={{ width: `${55 + i * 8}%` }} />
              <div className={styles.skeletonLine} style={{ width: '88%' }} />
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className={styles.errorBox} role="alert">
          {error}
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <section className={styles.emptyState} aria-label="Sin análisis">
          <div className={styles.emptyStateIcon} aria-hidden />
          <h2 className={styles.emptyStateTitle}>Aún no hay workspaces</h2>
          <p className={styles.emptyStateText}>
            Crea un análisis para subir fuentes y obtener el insight estructurado, o envía documentación al buzón
            configurado (Make → webhook) si está activo en tu entorno.
          </p>
          <Link href="/launcher/rfq-analysis/new" className={`${styles.primaryBtn} ${styles.emptyStateCta}`}>
            Crear primer análisis
          </Link>
        </section>
      ) : null}

      {!loading && items.length > 0 ? (
        <ul className={styles.cardList}>
          {items.map((a) => (
            <li
              key={a.id}
              className={`${styles.sectionCard} ${styles.listRow} ${styles.listCardShell}`}
            >
              <div className={styles.listCardInner}>
                <Link
                  className={styles.listCardMainHit}
                  href={`/launcher/rfq-analysis/${a.id}`}
                  aria-label={`Abrir workspace: ${a.title}`}
                >
                  <div className={styles.listRowMain}>
                    <h2 className={styles.listTitle}>{a.title}</h2>
                    <div className={styles.listMetaRow}>
                      <span
                        className={
                          a.sourceType === 'EMAIL' ? styles.listSourcePillEmail : styles.listSourcePillManual
                        }
                      >
                        {a.sourceType === 'EMAIL' ? 'Email' : 'Manual'}
                      </span>
                      {a.originSubject ? (
                        <span className={styles.listSubjectHint} title={a.originSubject}>
                          {a.originSubject}
                        </span>
                      ) : null}
                      {a.originEmail ? (
                        <span className={styles.listEmailHint} title={a.originEmail ?? undefined}>
                          {a.originEmail}
                        </span>
                      ) : null}
                    </div>
                    <p className={styles.listMetaDate}>
                      <span className={styles.listMetaDateLabel}>Creado</span>{' '}
                      <time dateTime={a.createdAt}>{formatCreatedAt(a.createdAt)}</time>
                    </p>
                  </div>
                  <span className={styles.listCardChevron} aria-hidden>
                    ›
                  </span>
                </Link>
                <div className={styles.listCardToolbar} role="group" aria-label="Estado y acciones">
                  <RfqStatusTag status={a.status} />
                  <button
                    type="button"
                    className={styles.listDeleteBtn}
                    disabled={deleteBusy}
                    onClick={() => setToDelete(a)}
                    aria-label={`Eliminar análisis «${a.title}»`}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <ConfirmDialog
        open={toDelete !== null}
        title="Eliminar análisis RFQ"
        message={
          toDelete
            ? `¿Eliminar el workspace «${toDelete.title}»? Se borrarán fuentes, resultado estructurado, conversación y adjuntos. Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          if (!deleteBusy) setToDelete(null);
        }}
      />
    </main>
  );
}
