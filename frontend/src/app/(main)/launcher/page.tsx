'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
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
import { CssStyled } from '@/components/CssStyled/CssStyled';
import { PageHero } from '@/components/page-hero';
import { apiFetch } from '@/lib/api';
import { probeCompanionExtension } from '@/lib/yubiq';
import styles from './launcher.module.css';

const COMMERCIAL_TILE_IDS = ['kyc', 'pipeline', 'rfqAnalysis', 'meddpicc'] as const satisfies readonly LauncherTileId[];
const ADMIN_TILE_IDS = ['activations', 'yubiq', 'administrativeProcesses'] as const satisfies readonly LauncherTileId[];

const COMMERCIAL_TILE_ID_SET = new Set<LauncherTileId>(COMMERCIAL_TILE_IDS);
const ADMIN_TILE_ID_SET = new Set<LauncherTileId>(ADMIN_TILE_IDS);

const LAUNCHER_TILE_IDS_ALL: LauncherTileId[] = [...COMMERCIAL_TILE_IDS, ...ADMIN_TILE_IDS];
const DEFAULT_TILE_ORDER: LauncherTileId[] = [...LAUNCHER_TILE_IDS_ALL];

/** Orden por defecto histórico (antes de secciones comercial / administrativo). */
const LEGACY_DEFAULT_TILE_ORDER: readonly LauncherTileId[] = [
  'activations',
  'pipeline',
  'yubiq',
  'rfqAnalysis',
  'meddpicc',
  'kyc',
];

/** Orden default intermedio (comercial con RFQ primero; sustituido por KYC primero). */
const PREVIOUS_DEFAULT_TILE_ORDER: readonly LauncherTileId[] = [
  'rfqAnalysis',
  'meddpicc',
  'kyc',
  'activations',
  'pipeline',
  'yubiq',
];

/** Pipeline aún en bloque administrativo; KYC primero en comercial. */
const PREVIOUS_DEFAULT_KYC_FIRST: readonly LauncherTileId[] = [
  'kyc',
  'rfqAnalysis',
  'meddpicc',
  'activations',
  'pipeline',
  'yubiq',
];

const LEGACY_SIX_TILES = ['activations', 'pipeline', 'yubiq', 'rfqAnalysis', 'meddpicc', 'kyc'] as const;
const LEGACY_FIVE_TILES = ['activations', 'pipeline', 'yubiq', 'rfqAnalysis', 'meddpicc'] as const;

function isLegacyDefaultTileOrder(order: LauncherTileId[]): boolean {
  return (
    order.length === LEGACY_DEFAULT_TILE_ORDER.length &&
    order.every((id, i) => id === LEGACY_DEFAULT_TILE_ORDER[i])
  );
}

function isPreviousDefaultTileOrder(order: LauncherTileId[]): boolean {
  return (
    order.length === PREVIOUS_DEFAULT_TILE_ORDER.length &&
    order.every((id, i) => id === PREVIOUS_DEFAULT_TILE_ORDER[i])
  );
}

function isPreviousDefaultKycFirst(order: LauncherTileId[]): boolean {
  return (
    order.length === PREVIOUS_DEFAULT_KYC_FIRST.length &&
    order.every((id, i) => id === PREVIOUS_DEFAULT_KYC_FIRST[i])
  );
}

const COMMERCIAL_COUNT = COMMERCIAL_TILE_IDS.length;

const LAUNCHER_SORTABLE_COMMERCIAL = 'launcher-commercial';
const LAUNCHER_SORTABLE_ADMIN = 'launcher-admin';

function canonicalizeLauncherOrder(perm: LauncherTileId[]): LauncherTileId[] {
  const commercial = perm.filter((id) => COMMERCIAL_TILE_ID_SET.has(id));
  const admin = perm.filter((id) => ADMIN_TILE_ID_SET.has(id));
  if (commercial.length !== COMMERCIAL_COUNT || admin.length !== ADMIN_TILE_IDS.length) {
    return [...DEFAULT_TILE_ORDER];
  }
  return [...commercial, ...admin];
}

/** Orden persistido del bloque comercial (primeros N del array). */
function commercialSegment(order: LauncherTileId[]): LauncherTileId[] {
  return order.slice(0, COMMERCIAL_COUNT);
}

/** Orden persistido del bloque administrativo. */
function administrativeSegment(order: LauncherTileId[]): LauncherTileId[] {
  return order.slice(COMMERCIAL_COUNT);
}

/** Vista normal: KYC primero dentro del bloque comercial. */
function commercialDisplayOrder(order: LauncherTileId[]): LauncherTileId[] {
  const seg = commercialSegment(order);
  const rest = seg.filter((id) => id !== 'kyc');
  return seg.includes('kyc') ? (['kyc', ...rest] as LauncherTileId[]) : [...seg];
}

function partitionLauncherOrder(order: LauncherTileId[]): {
  commercial: LauncherTileId[];
  administrative: LauncherTileId[];
} {
  return {
    commercial: commercialDisplayOrder(order),
    administrative: administrativeSegment(order),
  };
}

function normalizeTileOrder(raw: unknown): LauncherTileId[] {
  const allowed = new Set<string>(LAUNCHER_TILE_IDS_ALL);
  if (!Array.isArray(raw)) return [...DEFAULT_TILE_ORDER];
  const filtered = raw.filter((x): x is string => typeof x === 'string' && allowed.has(x));
  const unique = [...new Set(filtered)];
  if (
    unique.length === LAUNCHER_TILE_IDS_ALL.length &&
    new Set(unique).size === LAUNCHER_TILE_IDS_ALL.length &&
    LAUNCHER_TILE_IDS_ALL.every((id) => unique.includes(id))
  ) {
    const perm = unique as LauncherTileId[];
    if (
      isLegacyDefaultTileOrder(perm) ||
      isPreviousDefaultTileOrder(perm) ||
      isPreviousDefaultKycFirst(perm)
    ) {
      return [...DEFAULT_TILE_ORDER];
    }
    return canonicalizeLauncherOrder(perm);
  }
  const legacyFiveOk =
    unique.length === 5 &&
    new Set(unique).size === 5 &&
    LEGACY_FIVE_TILES.every((id) => unique.includes(id));
  if (legacyFiveOk) {
    return canonicalizeLauncherOrder([...(unique as LauncherTileId[]), 'kyc', 'administrativeProcesses']);
  }
  const legacySixOk =
    unique.length === 6 &&
    new Set(unique).size === 6 &&
    LEGACY_SIX_TILES.every((id) => unique.includes(id));
  if (legacySixOk) {
    return canonicalizeLauncherOrder([...(unique as LauncherTileId[]), 'administrativeProcesses']);
  }
  const legacyFour = ['activations', 'pipeline', 'yubiq', 'rfqAnalysis'] as const;
  if (
    unique.length === 4 &&
    new Set(unique).size === 4 &&
    unique.every((id) => legacyFour.includes(id as (typeof legacyFour)[number]))
  ) {
    return canonicalizeLauncherOrder([...(unique as LauncherTileId[]), 'meddpicc', 'kyc', 'administrativeProcesses']);
  }
  return [...DEFAULT_TILE_ORDER];
}

const TILE_ACCENT: Record<LauncherTileId, string> = {
  activations: styles.tileAccentActivations,
  pipeline: styles.tileAccentPipeline,
  yubiq: styles.tileAccentYubiq,
  rfqAnalysis: styles.tileAccentRfq,
  meddpicc: styles.tileAccentMeddpicc,
  kyc: styles.tileAccentKyc,
  administrativeProcesses: styles.tileAccentAdministrativeProcesses,
};

function TileLink({
  id,
  tileClassName,
  locked,
}: {
  id: LauncherTileId;
  tileClassName?: string;
  /** Sin clave Anthropic: mosaicos de IA no navegan (Yubiq, RFQ, MEDDPICC). */
  locked?: boolean;
}) {
  const accent = TILE_ACCENT[id];
  const featuredClass = id === 'kyc' && !tileClassName ? styles.tileFeaturedKyc : '';
  const tile = `${styles.tile} ${accent} ${featuredClass} ${tileClassName ?? ''}`.trim();
  switch (id) {
    case 'activations':
      return (
        <Link
          href="/launcher/activations/dashboard"
          className={styles.tileLink}
          aria-labelledby="tile-activations-heading"
        >
          <article className={tile}>
            <h3 id="tile-activations-heading" className={styles.tileTitle}>
              Activaciones
            </h3>
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
            <h3 id="tile-pipeline-heading" className={styles.tileTitle}>
              Pipeline Dashboard
            </h3>
            <p className={styles.tileDesc}>
              Pipeline de ventas, métricas y análisis por equipo y fase, basado en la recopilación semanal de datos desde HubSpot.
            </p>
            <span className={styles.tileCta}>Abrir Pipeline Dashboard →</span>
            <span className={`${styles.tileIcon} ${styles.tileIconPipeline}`} aria-hidden="true" />
          </article>
        </Link>
      );
    case 'yubiq':
      if (locked) {
        const lockedTile = `${styles.tile} ${accent} ${styles.tileLocked} ${tileClassName ?? ''}`.trim();
        return (
          <div
            className={styles.tileLinkDisabled}
            aria-labelledby="tile-yubiq-approve-seal-heading"
            aria-describedby="tile-yubiq-locked-hint"
            role="group"
          >
            <article className={lockedTile}>
              <h3 id="tile-yubiq-approve-seal-heading" className={styles.tileTitle}>
                Yubiq Approve &amp; Seal Filler
              </h3>
              <p className={styles.tileDesc}>
                Sube una oferta comercial en PDF, analízala con IA y obtén campos estructurados (título, cliente, importe,
                área Avvale y resumen).
              </p>
              <p id="tile-yubiq-locked-hint" className={styles.tileLockedHint}>
                Activa tu clave de API de Anthropic en{' '}
                <Link href="/profile#perfil-ai-credentials" className={styles.tileLockedLink}>
                  Perfil → AI Credentials
                </Link>{' '}
                para usar este módulo.
              </p>
              <span className={styles.tileCtaLocked}>Requiere API IA</span>
              <span className={`${styles.tileIcon} ${styles.tileIconYubiq}`} aria-hidden="true" />
            </article>
          </div>
        );
      }
      return (
        <Link
          href="/launcher/yubiq/approve-seal-filler"
          className={styles.tileLink}
          aria-labelledby="tile-yubiq-approve-seal-heading"
        >
          <article className={tile}>
            <h3 id="tile-yubiq-approve-seal-heading" className={styles.tileTitle}>
              Yubiq Approve &amp; Seal Filler
            </h3>
            <p className={styles.tileDesc}>
              Sube una oferta comercial en PDF, analízala con IA y obtén campos estructurados (título, cliente, importe, área Avvale y resumen).
            </p>
            <span className={styles.tileCta}>Abrir módulo →</span>
            <span className={`${styles.tileIcon} ${styles.tileIconYubiq}`} aria-hidden="true" />
          </article>
        </Link>
      );
    case 'rfqAnalysis':
      if (locked) {
        const lockedTile = `${styles.tile} ${accent} ${styles.tileLocked} ${tileClassName ?? ''}`.trim();
        return (
          <div
            className={styles.tileLinkDisabled}
            aria-labelledby="tile-rfq-analysis-heading"
            aria-describedby="tile-rfq-locked-hint"
            role="group"
          >
            <article className={lockedTile}>
              <h3 id="tile-rfq-analysis-heading" className={styles.tileTitle}>
                Análisis RFQs
              </h3>
              <p className={styles.tileDesc}>
                Workspace por oportunidad: documentos, análisis estructurado con IA y chat sobre el mismo contexto (manual o
                por email).
              </p>
              <p id="tile-rfq-locked-hint" className={styles.tileLockedHint}>
                Activa tu clave de API de Anthropic en{' '}
                <Link href="/profile#perfil-ai-credentials" className={styles.tileLockedLink}>
                  Perfil → AI Credentials
                </Link>{' '}
                para usar este módulo.
              </p>
              <span className={styles.tileCtaLocked}>Requiere API IA</span>
              <span className={`${styles.tileIcon} ${styles.tileIconRfq}`} aria-hidden="true" />
            </article>
          </div>
        );
      }
      return (
        <Link
          href="/launcher/rfq-analysis"
          className={styles.tileLink}
          aria-labelledby="tile-rfq-analysis-heading"
        >
          <article className={tile}>
            <h3 id="tile-rfq-analysis-heading" className={styles.tileTitle}>
              Análisis RFQs
            </h3>
            <p className={styles.tileDesc}>
              Workspace por oportunidad: documentos, análisis estructurado con IA y chat sobre el mismo contexto (manual o por email).
            </p>
            <span className={styles.tileCta}>Abrir módulo →</span>
            <span className={`${styles.tileIcon} ${styles.tileIconRfq}`} aria-hidden="true" />
          </article>
        </Link>
      );
    case 'meddpicc':
      if (locked) {
        const lockedTile = `${styles.tile} ${accent} ${styles.tileLocked} ${tileClassName ?? ''}`.trim();
        return (
          <div
            className={styles.tileLinkDisabled}
            aria-labelledby="tile-meddpicc-heading"
            aria-describedby="tile-meddpicc-locked-hint"
            role="group"
          >
            <article className={lockedTile}>
              <h3 id="tile-meddpicc-heading" className={styles.tileTitle}>
                MEDDPICC
              </h3>
              <p className={styles.tileDesc}>
                Cualificación de oportunidades B2B: ocho dimensiones MEDDPICC, puntuación y análisis con IA sobre el contexto del deal.
              </p>
              <p id="tile-meddpicc-locked-hint" className={styles.tileLockedHint}>
                Activa tu clave de API de Anthropic en{' '}
                <Link href="/profile#perfil-ai-credentials" className={styles.tileLockedLink}>
                  Perfil → AI Credentials
                </Link>{' '}
                para usar este módulo.
              </p>
              <span className={styles.tileCtaLocked}>Requiere API IA</span>
              <span className={`${styles.tileIcon} ${styles.tileIconMeddpicc}`} aria-hidden="true" />
            </article>
          </div>
        );
      }
      return (
        <Link href="/launcher/meddpicc" className={styles.tileLink} aria-labelledby="tile-meddpicc-heading">
          <article className={tile}>
            <h3 id="tile-meddpicc-heading" className={styles.tileTitle}>
              MEDDPICC
            </h3>
            <p className={styles.tileDesc}>
              Cualificación de oportunidades B2B: ocho dimensiones MEDDPICC, puntuación y análisis con IA sobre el contexto del deal.
            </p>
            <span className={styles.tileCta}>Abrir módulo →</span>
            <span className={`${styles.tileIcon} ${styles.tileIconMeddpicc}`} aria-hidden="true" />
          </article>
        </Link>
      );
    case 'kyc': {
      const hubMode = !tileClassName;
      return (
        <Link
          href="/launcher/kyc"
          className={styles.tileLink}
          aria-labelledby={hubMode ? 'tile-kyc-eyebrow tile-kyc-heading' : 'tile-kyc-heading'}
        >
          <article className={tile}>
            {hubMode ? (
              <span id="tile-kyc-eyebrow" className={styles.tileFeaturedEyebrow}>
                Espacio principal
              </span>
            ) : null}
            <h3 id="tile-kyc-heading" className={styles.tileTitle}>
              KYC —<br />
              Client Knowledge
            </h3>
            <p className={styles.tileDesc}>
              Base de cuentas, perfil comercial, organigrama, señales y chat de investigación. Actúa como punto central de otras
              herramientas.
            </p>
            <span className={styles.tileCta}>Abrir KYC →</span>
            <span className={`${styles.tileIcon} ${styles.tileIconKyc}`} aria-hidden="true" />
          </article>
        </Link>
      );
    }
    case 'administrativeProcesses':
      return (
        <Link
          href="/launcher/expenses-process/expenses"
          className={styles.tileLink}
          aria-labelledby="tile-expenses-process-heading"
        >
          <article className={tile}>
            <h3 id="tile-expenses-process-heading" className={styles.tileTitle}>
              Gastos
            </h3>
            <p className={styles.tileDesc}>
              Sube recibos, extrae los datos con IA y conserva el archivo para futuras automatizaciones.
            </p>
            <span className={styles.tileCta}>Abrir Gastos →</span>
            <span className={`${styles.tileIcon} ${styles.tileIconAdministrativeProcesses}`} aria-hidden="true" />
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
  aiLocked,
  containerId,
}: {
  id: LauncherTileId;
  reorderMode: boolean;
  aiLocked: boolean;
  containerId: typeof LAUNCHER_SORTABLE_COMMERCIAL | typeof LAUNCHER_SORTABLE_ADMIN;
}) {
  const tileLocked = aiLocked && (id === 'yubiq' || id === 'rfqAnalysis' || id === 'meddpicc');
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled: !reorderMode,
    data: {
      sortable: {
        containerId,
      },
    },
  });
  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.92 : 1,
  };

  return (
    <CssStyled
      as="li"
      ref={setNodeRef}
      cssProperties={sortableStyle}
      className={`${styles.sortableItem} ${isDragging ? styles.sortableItemDragging : ''}`}
      role="listitem"
      data-dragging={isDragging || undefined}
    >
      {reorderMode && (
        <span className={styles.dragHandle} aria-hidden>
          <GripIcon />
        </span>
      )}
      <div
        ref={setActivatorNodeRef}
        className={reorderMode ? styles.tileLinkOuter : styles.tileLinkOuterStatic}
        {...(reorderMode ? listeners : undefined)}
        {...(reorderMode ? attributes : undefined)}
        aria-label={reorderMode ? 'Arrastrar para reordenar el mosaico dentro de su sección' : undefined}
      >
        <TileLink
          id={id}
          tileClassName={reorderMode ? styles.tileReorder : undefined}
          locked={tileLocked}
        />
      </div>
    </CssStyled>
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
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const activeId = active.id as LauncherTileId;
      const overId = over.id as LauncherTileId;

      const activeContainer = active.data.current?.sortable?.containerId as string | undefined;
      const overContainer = over.data.current?.sortable?.containerId as string | undefined;
      if (!activeContainer || activeContainer !== overContainer) return;

      const commercialSeg = commercialSegment(order);
      const adminSeg = administrativeSegment(order);

      let newOrder: LauncherTileId[];
      if (activeContainer === LAUNCHER_SORTABLE_COMMERCIAL) {
        const oldIndex = commercialSeg.indexOf(activeId);
        const newIndex = commercialSeg.indexOf(overId);
        if (oldIndex < 0 || newIndex < 0) return;
        newOrder = [...arrayMove(commercialSeg, oldIndex, newIndex), ...adminSeg];
      } else {
        const oldIndex = adminSeg.indexOf(activeId);
        const newIndex = adminSeg.indexOf(overId);
        if (oldIndex < 0 || newIndex < 0) return;
        newOrder = [...commercialSeg, ...arrayMove(adminSeg, oldIndex, newIndex)];
      }

      const previous = [...order];
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
  const aiLocked = user?.hasAnthropicApiKey !== true;
  const { commercial: commercialTileOrder, administrative: administrativeTileOrder } = partitionLauncherOrder(order);

  return (
    <div className={`${styles.page} ${reorderMode ? 'app-motion-off' : ''}`}>
      <header className={`${styles.pageHeader} app-enter`}>
        <h2 className={styles.welcomeTitle}>Bienvenido, {displayName}</h2>
        <p className={styles.welcomeLead}>Tu espacio de trabajo con las aplicaciones internas de Avvale.</p>
      </header>

      {bannerVisible && (
        <section
          className={`${styles.welcomeBanner} app-enter app-enter-d1`}
          aria-label="Bienvenida a Avvale Companion App"
        >
          <div className={styles.welcomeBannerOverlay}>
            <button
              type="button"
              className={styles.welcomeBannerClose}
              onClick={() => {
                setBannerVisible(false);
                setReorderMode(false);
              }}
              aria-label="Cerrar banner de bienvenida"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M18 6L6 18M6 6l12 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <div className={styles.welcomeBannerInner}>
              <p className={styles.welcomeBannerKicker}>Avvale Companion</p>
              <h3 className={styles.welcomeBannerTitle}>Te damos la bienvenida a Avvale Companion App</h3>
              <p className={styles.welcomeBannerSubtitle}>
                Un ecosistema de aplicaciones internas creado para reunir en un único punto de acceso distintas
                soluciones desarrolladas por Avvale, orientadas a optimizar operaciones, acelerar tareas recurrentes y
                dar soporte a procesos de negocio y gestión interna.
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
                        <svg
                          viewBox="0 0 24 24"
                          width="18"
                          height="18"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.25"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </span>
                      Listo
                    </>
                  ) : (
                    <>
                      <span className={styles.bannerBtnIcon} aria-hidden>
                        <svg
                          viewBox="0 0 24 24"
                          width="18"
                          height="18"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </span>
                      Editar mis intereses
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className={styles.pageHeroWrap}>
        <PageHero
          className={bannerVisible ? 'app-enter-d2' : 'app-enter-d1'}
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
      </div>

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
              Arrastra cada mosaico dentro de su sección (comercial o administrativa). No se puede mover un mosaico de una
              categoría a otra. El orden se guarda automáticamente al soltar.
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
          <div className={`${styles.tileSections} ${styles.tileSectionsEnter}`}>
            <section
              className={`${styles.tileSection} ${styles.tileSectionEnter}`}
              aria-labelledby="launcher-section-commercial-heading"
            >
              <h2
                id="launcher-section-commercial-heading"
                className={`${styles.tileSectionTitle} ${styles.tileSectionTitleEnter}`}
              >
                Herramientas comerciales
              </h2>
              <SortableContext
                id={LAUNCHER_SORTABLE_COMMERCIAL}
                items={commercialSegment(order)}
                strategy={rectSortingStrategy}
              >
                <ul className={`${styles.tilesGrid} ${styles.tilesGridReorder}`} role="list">
                  {commercialSegment(order).map((id) => (
                    <SortableTile
                      key={id}
                      id={id}
                      reorderMode={reorderMode}
                      aiLocked={aiLocked}
                      containerId={LAUNCHER_SORTABLE_COMMERCIAL}
                    />
                  ))}
                </ul>
              </SortableContext>
            </section>
            <section
              className={`${styles.tileSection} ${styles.tileSectionAdmin} ${styles.tileSectionEnter}`}
              aria-labelledby="launcher-section-admin-heading"
            >
              <h2
                id="launcher-section-admin-heading"
                className={`${styles.tileSectionTitle} ${styles.tileSectionTitleEnter}`}
              >
                Procesos administrativos
              </h2>
              <SortableContext
                id={LAUNCHER_SORTABLE_ADMIN}
                items={administrativeSegment(order)}
                strategy={rectSortingStrategy}
              >
                <ul className={`${styles.tilesGrid} ${styles.tilesGridReorder}`} role="list">
                  {administrativeSegment(order).map((id) => (
                    <SortableTile
                      key={id}
                      id={id}
                      reorderMode={reorderMode}
                      aiLocked={aiLocked}
                      containerId={LAUNCHER_SORTABLE_ADMIN}
                    />
                  ))}
                </ul>
              </SortableContext>
            </section>
          </div>
        </DndContext>
      ) : (
        <div className={`${styles.tileSections} ${styles.tileSectionsEnter}`}>
          <section
            className={`${styles.tileSection} ${styles.tileSectionEnter}`}
            aria-labelledby="launcher-section-commercial-heading"
          >
            <h2
              id="launcher-section-commercial-heading"
              className={`${styles.tileSectionTitle} ${styles.tileSectionTitleEnter}`}
            >
              Herramientas comerciales
            </h2>
            <ul className={`${styles.tilesGrid} ${styles.tilesGridAnimated}`} role="list">
              {commercialTileOrder.map((id) => (
                <li key={id} className={styles.sortableItemStatic} role="listitem">
                  <TileLink id={id} locked={aiLocked && (id === 'yubiq' || id === 'rfqAnalysis' || id === 'meddpicc')} />
                </li>
              ))}
            </ul>
          </section>
          <section
            className={`${styles.tileSection} ${styles.tileSectionAdmin} ${styles.tileSectionEnter}`}
            aria-labelledby="launcher-section-admin-heading"
          >
            <h2
              id="launcher-section-admin-heading"
              className={`${styles.tileSectionTitle} ${styles.tileSectionTitleEnter}`}
            >
              Procesos administrativos
            </h2>
            <ul className={`${styles.tilesGrid} ${styles.tilesGridAnimated}`} role="list">
              {administrativeTileOrder.map((id) => (
                <li key={id} className={styles.sortableItemStatic} role="listitem">
                  <TileLink id={id} locked={aiLocked && (id === 'yubiq' || id === 'rfqAnalysis' || id === 'meddpicc')} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      <LauncherWalkthrough open={walkthroughOpen} onClose={handleWalkthroughClose} />
    </div>
  );
}
