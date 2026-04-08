'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { PageBreadcrumb, PageHero, PageBackLink, ChevronBackIcon } from '@/components/page-hero';
import { RfqStatusTag } from '@/components/RfqStatusTag/RfqStatusTag';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { InfoDialog } from '@/components/InfoDialog/InfoDialog';
import { FilterBar, type StatusFilterOption } from '@/components/FilterBar/FilterBar';
import { useSmoothLoading } from '@/hooks/useSmoothLoading';
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

const LIST_INITIAL_VISIBLE = 3;

const RFQ_STATUS_OPTIONS: StatusFilterOption[] = [
  { value: '', label: 'Todos' },
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'QUEUED', label: 'En cola' },
  { value: 'PROCESSING', label: 'Procesando' },
  { value: 'COMPLETED', label: 'Completado' },
  { value: 'FAILED', label: 'Error' },
  { value: 'REJECTED', label: 'Rechazado' },
];

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Item | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [listExpanded, setListExpanded] = useState(false);

  const listLoadingVisible = useSmoothLoading(loading, { delayMs: 150, minVisibleMs: 250 });

  const filteredItems = useMemo(() => {
    let data = items;
    if (sourceFilter === 'EMAIL') data = data.filter((x) => x.sourceType === 'EMAIL');
    else if (sourceFilter === 'MANUAL') data = data.filter((x) => x.sourceType !== 'EMAIL');

    if (statusFilter) data = data.filter((x) => x.status === statusFilter);

    const q = searchValue.trim().toLowerCase();
    if (q) {
      data = data.filter(
        (x) =>
          x.title.toLowerCase().includes(q) ||
          (x.originSubject?.toLowerCase().includes(q) ?? false) ||
          (x.originEmail?.toLowerCase().includes(q) ?? false),
      );
    }
    return data;
  }, [items, sourceFilter, statusFilter, searchValue]);

  useEffect(() => {
    setListExpanded(false);
  }, [sourceFilter, statusFilter, searchValue]);

  const visibleListItems = useMemo(() => {
    if (listExpanded || filteredItems.length <= LIST_INITIAL_VISIBLE) return filteredItems;
    return filteredItems.slice(0, LIST_INITIAL_VISIBLE);
  }, [filteredItems, listExpanded]);

  const hiddenListCount = Math.max(0, filteredItems.length - LIST_INITIAL_VISIBLE);
  const peekItem = !listExpanded && filteredItems.length > LIST_INITIAL_VISIBLE ? filteredItems[LIST_INITIAL_VISIBLE] : null;

  const resetListFilters = () => {
    setSourceFilter('all');
    setStatusFilter('');
    setSearchValue('');
  };

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
        subtitle="Filtra por origen, estado o texto; cada fila es un workspace con fuentes, insight con IA y chat sobre el mismo contexto."
      />

      <div className={styles.filtersCard}>
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
          </div>
          <div className={styles.toolbar}>
            <button type="button" className={styles.secondaryBtn} onClick={() => setHelpOpen(true)}>
              Cómo funciona
            </button>
            <Link href="/launcher/rfq-analysis/new" className={styles.primaryBtn}>
              Nuevo análisis
            </Link>
          </div>
        </div>
        <FilterBar
          className={styles.filterBarEmbed}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          statusOptions={RFQ_STATUS_OPTIONS}
          searchPlaceholder="Título, asunto del correo o remitente…"
        />
      </div>

      {!loading && !error ? (
        <div className={styles.resultsToolbar} aria-live="polite">
          <h2 className={styles.resultsTitle}>Workspaces</h2>
          <p className={styles.resultsMeta}>
            {filteredItems.length === items.length ? (
              <>
                <strong>{items.length}</strong> {items.length === 1 ? 'análisis' : 'análisis'}
              </>
            ) : (
              <>
                Mostrando <strong>{filteredItems.length}</strong> de <strong>{items.length}</strong>
              </>
            )}
          </p>
        </div>
      ) : null}

      {listLoadingVisible ? (
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
        <section className={styles.emptyState} aria-label="Sin resultados con estos filtros">
          <div className={styles.emptyStateIcon} aria-hidden />
          <h2 className={styles.emptyStateTitle}>Ningún análisis coincide</h2>
          <p className={styles.emptyStateText}>
            Prueba a limpiar la búsqueda, el estado o el origen (manual/email). Hay{' '}
            {items.length === 1 ? '1 análisis' : `${items.length} análisis`} en tu workspace.
          </p>
          <button
            type="button"
            className={`${styles.secondaryBtn} ${styles.emptyStateCta}`}
            onClick={resetListFilters}
          >
            Limpiar filtros
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
        <>
          <ul id="rfq-analysis-workspace-list" className={styles.cardList}>
            {visibleListItems.map((a) => (
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
          {peekItem ? (
            <div className={styles.listPeek} aria-hidden="true">
              <div className={`${styles.sectionCard} ${styles.listRow} ${styles.listCardShell} ${styles.listPeekCard}`}>
                <div className={styles.listCardInner}>
                  <div className={styles.listCardMainHit} role="presentation">
                    <div className={styles.listRowMain}>
                      <h2 className={styles.listTitle}>{peekItem.title}</h2>
                      <div className={styles.listMetaRow}>
                        <span
                          className={
                            peekItem.sourceType === 'EMAIL' ? styles.listSourcePillEmail : styles.listSourcePillManual
                          }
                        >
                          {peekItem.sourceType === 'EMAIL' ? 'Email' : 'Manual'}
                        </span>
                        {peekItem.originSubject ? (
                          <span className={styles.listSubjectHint} title={peekItem.originSubject}>
                            {peekItem.originSubject}
                          </span>
                        ) : null}
                        {peekItem.originEmail ? (
                          <span className={styles.listEmailHint} title={peekItem.originEmail ?? undefined}>
                            {peekItem.originEmail}
                          </span>
                        ) : null}
                      </div>
                      <p className={styles.listMetaDate}>
                        <span className={styles.listMetaDateLabel}>Creado</span>{' '}
                        <time dateTime={peekItem.createdAt}>{formatCreatedAt(peekItem.createdAt)}</time>
                      </p>
                    </div>
                    <span className={styles.listCardChevron} aria-hidden>
                      ›
                    </span>
                  </div>
                  <div className={styles.listCardToolbar} role="presentation">
                    <RfqStatusTag status={peekItem.status} />
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {filteredItems.length > LIST_INITIAL_VISIBLE ? (
            <div className={styles.listShowMoreWrap}>
              {!listExpanded ? (
                <button
                  type="button"
                  className={`${styles.secondaryBtn} ${styles.listShowMoreBtn}`}
                  onClick={() => setListExpanded(true)}
                  aria-expanded={false}
                  aria-controls="rfq-analysis-workspace-list"
                >
                  Mostrar más
                  <span className={styles.listShowMoreCount}> ({hiddenListCount} más)</span>
                  <span className={styles.listShowMoreIcon} aria-hidden />
                </button>
              ) : (
                <button
                  type="button"
                  className={`${styles.secondaryBtn} ${styles.listShowMoreBtn}`}
                  onClick={() => setListExpanded(false)}
                  aria-expanded
                  aria-controls="rfq-analysis-workspace-list"
                >
                  Mostrar menos
                  <span className={styles.listShowMoreIcon} aria-hidden />
                </button>
              )}
            </div>
          ) : null}
        </>
      ) : null}

      <InfoDialog
        open={helpOpen}
        title="Análisis RFQs: procedimiento y correo"
        onClose={() => setHelpOpen(false)}
        footerStart={
          <Link
            href="/launcher/rfq-analysis/email"
            className={styles.infoFooterLink}
            onClick={() => setHelpOpen(false)}
          >
            Documentación técnica (Make, webhook)
          </Link>
        }
      >
        <p className={styles.helpDialogLead}>
          Usa los filtros de la tarjeta superior (origen manual/email, estado y búsqueda) para acotar la lista de
          workspaces.
        </p>
        <section className={styles.helpDialogSection} aria-label="Creación manual">
          <h3 className={styles.helpDialogH3}>Creación manual</h3>
          <p>
            Usa <strong>Nuevo análisis</strong> para subir documentos desde la app. Se genera un workspace por
            oportunidad con fuentes, resultado estructurado con IA y chat sobre el mismo contexto.
          </p>
        </section>
        <section className={styles.helpDialogSection} aria-label="Entrada por correo">
          <h3 className={styles.helpDialogH3}>Entrada por correo</h3>
          <p>
            Envía el correo <strong>desde la misma dirección</strong> con la que inicias sesión en Avvale Companion
            (usuario registrado). Dirección de buzón de escaneo:
          </p>
          <p className={styles.helpDialogEmail}>
            <code>scanner@avvalecompanion.app</code>
          </p>
          <p>
            Una integración externa (por ejemplo Make) reenvía el contenido al servidor; se crea un análisis vinculado
            a tu usuario. <strong>Si el remitente no está dado de alta</strong>, no se creará el workspace.
          </p>
        </section>
        <section className={styles.helpDialogSection} aria-label="Limitaciones">
          <h3 className={styles.helpDialogH3}>Limitaciones habituales</h3>
          <ul className={styles.helpDialogList}>
            <li>
              Límite de <strong>tamaño</strong> y <strong>número</strong> de adjuntos por análisis (lo marca la
              configuración del servidor).
            </li>
            <li>Formatos de archivo soportados para extracción de texto (p. ej. PDF, ofimática según configuración).</li>
            <li>Límites del proveedor de correo, proxy o firewall corporativo (tamaño de mensaje, bloqueos).</li>
            <li>
              El cuerpo del mensaje y los adjuntos deben poder procesarse; mensajes vacíos o no válidos pueden
              rechazarse.
            </li>
          </ul>
        </section>
      </InfoDialog>

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
