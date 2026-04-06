'use client';

import { useEffect, useMemo, useState } from 'react';
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

type SourceFilter = 'all' | 'MANUAL' | 'EMAIL';

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
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [helpOpen, setHelpOpen] = useState(false);

  const filteredItems = useMemo(() => {
    if (sourceFilter === 'all') return items;
    if (sourceFilter === 'EMAIL') return items.filter((x) => x.sourceType === 'EMAIL');
    return items.filter((x) => x.sourceType !== 'EMAIL');
  }, [items, sourceFilter]);

  useEffect(() => {
    if (!helpOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHelpOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [helpOpen]);

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
      />

      <div className={styles.listHeroToolbar}>
        <div className={styles.listHeroToolbarStart}>
          <div
            className={styles.sourceFilter}
            role="group"
            aria-label="Filtrar por origen del análisis"
          >
            {(
              [
                { id: 'all' as const, label: 'Todos' },
                { id: 'MANUAL' as const, label: 'Manual' },
                { id: 'EMAIL' as const, label: 'Email' },
              ] as const
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={
                  sourceFilter === id
                    ? `${styles.sourceFilterBtn} ${styles.sourceFilterBtnActive}`
                    : styles.sourceFilterBtn
                }
                aria-pressed={sourceFilter === id}
                onClick={() => setSourceFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {!loading ? (
            <button
              type="button"
              className={`${styles.toolbarCount} ${styles.toolbarCountButton}`}
              onClick={() => setHelpOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={helpOpen}
              aria-label="Cómo funcionan los análisis RFQ y el envío por correo"
            >
              {sourceFilter === 'all'
                ? total === 1
                  ? '1 análisis'
                  : `${total} análisis`
                : filteredItems.length === 1
                  ? '1 resultado'
                  : `${filteredItems.length} resultados`}
              {sourceFilter !== 'all' && total > 0 ? (
                <span className={styles.toolbarCountMuted}> · {total} en total</span>
              ) : null}
            </button>
          ) : null}
        </div>
        <div className={styles.toolbar}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => setHelpOpen(true)}
          >
            Entrada por email
          </button>
          <Link href="/launcher/rfq-analysis/new" className={styles.primaryBtn}>
            Nuevo análisis
          </Link>
        </div>
      </div>

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

      {!loading && !error && items.length > 0 && filteredItems.length === 0 ? (
        <section className={styles.emptyState} aria-label="Sin resultados con este filtro">
          <div className={styles.emptyStateIcon} aria-hidden />
          <h2 className={styles.emptyStateTitle}>Ningún análisis con este filtro</h2>
          <p className={styles.emptyStateText}>
            Prueba con «Todos» o cambia entre manual y email. Hay {total === 1 ? '1 análisis' : `${total} análisis`}{' '}
            en el workspace.
          </p>
          <button
            type="button"
            className={`${styles.secondaryBtn} ${styles.emptyStateCta}`}
            onClick={() => setSourceFilter('all')}
          >
            Mostrar todos
          </button>
        </section>
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

      {!loading && filteredItems.length > 0 ? (
        <ul className={styles.cardList}>
          {filteredItems.map((a) => (
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

      {helpOpen ? (
        <div
          className={styles.helpOverlay}
          role="presentation"
          onClick={() => setHelpOpen(false)}
        >
          <div
            className={styles.helpDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rfq-list-help-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="rfq-list-help-title" className={styles.helpDialogTitle}>
              Análisis RFQs: procedimiento y correo
            </h2>
            <div className={styles.helpDialogBody}>
              <p className={styles.helpDialogLead}>
                El número que ves es la cantidad de workspaces en este listado (según el filtro: todos, solo
                manuales o solo creados por email).
              </p>
              <section className={styles.helpDialogSection} aria-label="Creación manual">
                <h3 className={styles.helpDialogH3}>Creación manual</h3>
                <p>
                  Usa <strong>Nuevo análisis</strong> para subir documentos desde la app. Se genera un
                  workspace por oportunidad con fuentes, resultado estructurado con IA y chat sobre el mismo
                  contexto.
                </p>
              </section>
              <section className={styles.helpDialogSection} aria-label="Entrada por correo">
                <h3 className={styles.helpDialogH3}>Entrada por correo</h3>
                <p>
                  Envía el correo <strong>desde la misma dirección</strong> con la que inicias sesión en Avvale
                  Companion (usuario registrado). Dirección de buzón de escaneo:
                </p>
                <p className={styles.helpDialogEmail}>
                  <code>scanner@avvalecompanion.app</code>
                </p>
                <p>
                  Una integración externa (por ejemplo Make) reenvía el contenido al servidor; se crea un
                  análisis vinculado a tu usuario. <strong>Si el remitente no está dado de alta</strong>, no se
                  creará el workspace.
                </p>
              </section>
              <section className={styles.helpDialogSection} aria-label="Limitaciones">
                <h3 className={styles.helpDialogH3}>Limitaciones habituales</h3>
                <ul className={styles.helpDialogList}>
                  <li>Límite de <strong>tamaño</strong> y <strong>número</strong> de adjuntos por análisis (lo marca la configuración del servidor).</li>
                  <li>Formatos de archivo soportados para extracción de texto (p. ej. PDF, ofimática según configuración).</li>
                  <li>Límites del proveedor de correo, proxy o firewall corporativo (tamaño de mensaje, bloqueos).</li>
                  <li>El cuerpo del mensaje y los adjuntos deben poder procesarse; mensajes vacíos o no válidos pueden rechazarse.</li>
                </ul>
              </section>
            </div>
            <div className={styles.helpDialogFooter}>
              <Link
                href="/launcher/rfq-analysis/email"
                className={styles.helpDialogTechLink}
                onClick={() => setHelpOpen(false)}
              >
                Documentación técnica (Make, webhook)
              </Link>
              <button
                type="button"
                className={styles.helpDialogClose}
                onClick={() => setHelpOpen(false)}
                data-autofocus
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
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
