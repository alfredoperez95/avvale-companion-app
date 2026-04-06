'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useUser, useRefreshUser, type LauncherTileId } from '@/contexts/UserContext';
import {
  LauncherWalkthrough,
  LAUNCHER_WALKTHROUGH_DISMISSED,
  LAUNCHER_WALKTHROUGH_STORAGE_KEY,
} from '@/components/launcher/LauncherWalkthrough';
import { PageHero } from '@/components/page-hero';
import { apiFetch } from '@/lib/api';
import { probeCompanionExtension } from '@/lib/yubiq';
import styles from './launcher.module.css';

const DEFAULT_TILE_ORDER: LauncherTileId[] = ['activations', 'pipeline', 'yubiq', 'rfqAnalysis'];

function normalizeTileOrder(raw: unknown): LauncherTileId[] {
  if (!Array.isArray(raw) || raw.length !== 4) return [...DEFAULT_TILE_ORDER];
  const allowed = new Set<string>(['activations', 'pipeline', 'yubiq', 'rfqAnalysis']);
  if (new Set(raw).size !== 4) return [...DEFAULT_TILE_ORDER];
  if (!raw.every((x) => typeof x === 'string' && allowed.has(x))) return [...DEFAULT_TILE_ORDER];
  return raw as LauncherTileId[];
}

const TILE_ACCENT: Record<LauncherTileId, string> = {
  activations: styles.tileAccentActivations,
  pipeline: styles.tileAccentPipeline,
  yubiq: styles.tileAccentYubiq,
  rfqAnalysis: styles.tileAccentRfq,
};

function TileLink({
  id,
  tileClassName,
}: {
  id: LauncherTileId;
  tileClassName?: string;
}) {
  const accent = TILE_ACCENT[id];
  const tile = `${styles.tile} ${accent} ${tileClassName ?? ''}`.trim();
  switch (id) {
    case 'activations':
      return (
        <Link
          href="/launcher/activations/dashboard"
          className={styles.tileLink}
          aria-labelledby="tile-activations-heading"
        >
          <article className={tile}>
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
      );
    case 'pipeline':
      return (
        <Link
          href="https://pipeline-ten-taupe.vercel.app/dashboard"
          className={styles.tileLink}
          aria-labelledby="tile-pipeline-heading"
          target="_blank"
          rel="noopener noreferrer"
        >
          <article className={tile}>
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
      );
    case 'yubiq':
      return (
        <Link
          href="/launcher/yubiq/approve-seal-filler"
          className={styles.tileLink}
          aria-labelledby="tile-yubiq-approve-seal-heading"
        >
          <article className={tile}>
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
      );
    case 'rfqAnalysis':
      return (
        <Link
          href="/launcher/rfq-analysis"
          className={styles.tileLink}
          aria-labelledby="tile-rfq-analysis-heading"
        >
          <article className={tile}>
            <h2 id="tile-rfq-analysis-heading" className={styles.tileTitle}>
              Análisis RFQs
            </h2>
            <p className={styles.tileDesc}>
              Workspace por oportunidad: documentos, análisis estructurado con IA y chat sobre el mismo contexto (manual o por email).
            </p>
            <span className={styles.tileCta}>Abrir módulo →</span>
            <span className={`${styles.tileIcon} ${styles.tileIconRfq}`} aria-hidden="true" />
          </article>
        </Link>
      );
    default:
      return null;
  }
}

function GripIcon() {
  return (
    <svg className={styles.dragHandleSvg} viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <circle cx="9" cy="7" r="1.35" fill="currentColor" />
      <circle cx="15" cy="7" r="1.35" fill="currentColor" />
      <circle cx="9" cy="12" r="1.35" fill="currentColor" />
      <circle cx="15" cy="12" r="1.35" fill="currentColor" />
      <circle cx="9" cy="17" r="1.35" fill="currentColor" />
      <circle cx="15" cy="17" r="1.35" fill="currentColor" />
    </svg>
  );
}

function SortableTile({
  id,
  reorderMode,
}: {
  id: LauncherTileId;
  reorderMode: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !reorderMode,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.92 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`${styles.sortableItem} ${isDragging ? styles.sortableItemDragging : ''}`}
      role="listitem"
      data-dragging={isDragging || undefined}
    >
      {reorderMode && (
        <button
          type="button"
          className={styles.dragHandle}
          {...attributes}
          {...listeners}
          aria-label="Arrastrar para reordenar el mosaico"
        >
          <GripIcon />
        </button>
      )}
      <div className={reorderMode ? styles.tileLinkOuter : styles.tileLinkOuterStatic}>
        <TileLink id={id} tileClassName={reorderMode ? styles.tileReorder : undefined} />
      </div>
    </li>
  );
}

export default function LauncherPage() {
  const user = useUser();
  const refreshUser = useRefreshUser();
  const [bannerVisible, setBannerVisible] = useState(true);
  const [reorderMode, setReorderMode] = useState(false);
  const [order, setOrder] = useState<LauncherTileId[]>(DEFAULT_TILE_ORDER);
  const [isSaving, setIsSaving] = useState(false);
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const [companionExtension, setCompanionExtension] = useState<'checking' | 'yes' | 'no'>('checking');

  useEffect(() => {
    setOrder(normalizeTileOrder(user?.launcherTileOrder));
  }, [user?.launcherTileOrder]);

  useEffect(() => {
    let cancelled = false;
    void probeCompanionExtension({ timeoutMs: 700 }).then((ok) => {
      if (!cancelled) setCompanionExtension(ok ? 'yes' : 'no');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Abre el walkthrough al cargar solo si la extensión no responde al ping y el usuario no eligió "No volver a mostrar". */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (companionExtension !== 'no') return;
    try {
      if (localStorage.getItem(LAUNCHER_WALKTHROUGH_STORAGE_KEY) === LAUNCHER_WALKTHROUGH_DISMISSED) return;
      setWalkthroughOpen(true);
    } catch {
      setWalkthroughOpen(true);
    }
  }, [companionExtension]);

  const handleWalkthroughClose = (reason: 'later' | 'permanent') => {
    if (reason === 'permanent') {
      try {
        localStorage.setItem(LAUNCHER_WALKTHROUGH_STORAGE_KEY, LAUNCHER_WALKTHROUGH_DISMISSED);
      } catch {
        /* ignore quota / private mode */
      }
    }
    setWalkthroughOpen(false);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = order.indexOf(active.id as LauncherTileId);
      const newIndex = order.indexOf(over.id as LauncherTileId);
      if (oldIndex < 0 || newIndex < 0) return;
      const previous = [...order];
      const newOrder = arrayMove(order, oldIndex, newIndex);
      setOrder(newOrder);
      setIsSaving(true);
      try {
        const res = await apiFetch('/api/auth/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ launcherTileOrder: newOrder }),
        });
        if (res.ok) await refreshUser();
        else setOrder(previous);
      } catch {
        setOrder(previous);
      } finally {
        setIsSaving(false);
      }
    },
    [order, refreshUser],
  );

  const displayName = user?.name?.trim() || user?.email || 'Usuario';

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h2 className={styles.welcomeTitle}>Bienvenido, {displayName}</h2>
        <p className={styles.welcomeLead}>Tu espacio de trabajo con las aplicaciones internas de Avvale.</p>
      </header>

      {bannerVisible && (
        <section className={styles.welcomeBanner} aria-label="Bienvenida a Avvale Companion Apps">
          <div className={styles.welcomeBannerOverlay}>
            <h3 className={styles.welcomeBannerTitle}>Te damos la bienvenida a Avvale Companion Apps</h3>
            <p className={styles.welcomeBannerSubtitle}>
              Un ecosistema de aplicaciones internas creado para reunir en un único punto de acceso distintas soluciones desarrolladas por Avvale, orientadas a optimizar operaciones, acelerar tareas recurrentes y dar soporte a procesos de negocio y gestión interna.
            </p>
            <div className={styles.welcomeBannerActions}>
              <button
                type="button"
                className={styles.welcomeBannerBtnPrimary}
                onClick={() => setReorderMode((v) => !v)}
                aria-pressed={reorderMode}
                aria-label={reorderMode ? 'Salir del modo reordenar mosaicos' : 'Editar orden de mosaicos'}
              >
                {reorderMode ? (
                  <>
                    <span className={styles.bannerBtnIcon} aria-hidden>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </span>
                    Listo
                  </>
                ) : (
                  <>
                    <span className={styles.bannerBtnIcon} aria-hidden>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </span>
                    Editar mis intereses
                  </>
                )}
              </button>
              <button
                type="button"
                className={styles.welcomeBannerBtnSecondary}
                onClick={() => {
                  setBannerVisible(false);
                  setReorderMode(false);
                }}
                aria-label="Cerrar banner"
              >
                Cerrar
              </button>
            </div>
          </div>
        </section>
      )}

      <PageHero
        title="App Launcher"
        subtitle="Elige una aplicación para abrirla en esta sesión."
        actions={
          <>
            <button
              type="button"
              className={styles.walkthroughHelpBtn}
              onClick={() => setWalkthroughOpen(true)}
              aria-haspopup="dialog"
            >
              <span className={styles.walkthroughHelpIcon} aria-hidden>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </span>
              Cómo funciona
            </button>
            <span
              className={`${styles.extensionStatusBadge} ${
                companionExtension === 'yes'
                  ? styles.extensionStatusBadgeOk
                  : companionExtension === 'no'
                    ? styles.extensionStatusBadgeNo
                    : styles.extensionStatusBadgePending
              }`}
              role="status"
              aria-live="polite"
              title="Indica si Avvale Companion responde en esta pestaña (content script activo)."
            >
              <span className={styles.extensionStatusDot} aria-hidden />
              {companionExtension === 'checking'
                ? 'Comprobando extensión…'
                : companionExtension === 'yes'
                  ? 'Extensión instalada'
                  : 'Extensión no detectada'}
            </span>
            {!bannerVisible ? (
              <button
                type="button"
                className={styles.launcherCustomizeBtn}
                onClick={() => setReorderMode((v) => !v)}
                aria-pressed={reorderMode}
              >
                {reorderMode ? (
                  <>
                    <span className={styles.launcherCustomizeIcon} aria-hidden>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </span>
                    Listo
                  </>
                ) : (
                  <>
                    <span className={styles.launcherCustomizeIcon} aria-hidden>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                    </span>
                    Ordenar mosaicos
                  </>
                )}
              </button>
            ) : null}
          </>
        }
      />

      {reorderMode && (
        <div className={styles.reorderStrip} role="status" aria-live="polite">
          <span className={styles.reorderStripIcon} aria-hidden>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 6h13" />
              <path d="M8 12h13" />
              <path d="M8 18h13" />
              <path d="M3 6h.01" />
              <path d="M3 12h.01" />
              <path d="M3 18h.01" />
            </svg>
          </span>
          <div className={styles.reorderStripBody}>
            <p className={styles.reorderStripTitle}>Modo edición activo</p>
            <p className={styles.reorderStripText}>
              Arrastra cada mosaico por el asa superior izquierda. El orden se guarda automáticamente al soltar.
            </p>
          </div>
          {isSaving && (
            <span className={styles.savingBadge}>
              <span className={styles.savingDot} aria-hidden />
              Guardando…
            </span>
          )}
        </div>
      )}

      {reorderMode ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={order} strategy={rectSortingStrategy}>
            <ul className={`${styles.tilesGrid} ${styles.tilesGridReorder}`} role="list">
              {order.map((id) => (
                <SortableTile key={id} id={id} reorderMode={reorderMode} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      ) : (
        <ul className={styles.tilesGrid} role="list">
          {order.map((id) => (
            <li key={id} className={styles.sortableItemStatic} role="listitem">
              <TileLink id={id} />
            </li>
          ))}
        </ul>
      )}

      <LauncherWalkthrough open={walkthroughOpen} onClose={handleWalkthroughClose} />
    </div>
  );
}
