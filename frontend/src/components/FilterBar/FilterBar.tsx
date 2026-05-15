'use client';

import { useId, useState } from 'react';
import styles from './FilterBar.module.css';

export type SolicitanteOption = { id: string; name?: string | null; lastName?: string | null; email: string };

export type StatusFilterOption = { value: string; label: string };

const ACTIVATION_STATUS_OPTIONS: StatusFilterOption[] = [
  { value: '', label: 'Todos' },
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'QUEUED', label: 'En cola' },
  { value: 'PROCESSING', label: 'Procesando' },
  { value: 'RETRYING', label: 'Reintentando' },
  { value: 'PENDING_CALLBACK', label: 'Esperando' },
  { value: 'SENT', label: 'Enviado' },
  { value: 'FAILED', label: 'Error envío' },
];

interface FilterBarProps {
  /** Clase adicional en el contenedor (p. ej. anidado en una tarjeta). */
  className?: string;
  /** Estilo compacto para `.filtersCard` (rejilla, cabecera, sin borde inferior). */
  embedded?: boolean;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  solicitanteFilter?: string;
  onSolicitanteFilterChange?: (userId: string) => void;
  solicitanteOptions?: SolicitanteOption[];
  solicitanteLoading?: boolean;
  /** Si se define, sustituye las opciones de estado (p. ej. RFQ vs activaciones). */
  statusOptions?: StatusFilterOption[];
  searchPlaceholder?: string;
  /** Entrada animada del bloque (desactivar si la página ya anima el contenido). */
  animateEnter?: boolean;
}

function getSolicitanteLabel(u: SolicitanteOption): string {
  const full = [u.name, u.lastName].filter(Boolean).join(' ').trim();
  return full || u.email;
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" strokeLinecap="round" />
    </svg>
  );
}

function SelectChevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FilterBar({
  className,
  embedded = false,
  statusFilter,
  onStatusFilterChange,
  searchValue = '',
  onSearchChange,
  solicitanteFilter = '',
  onSolicitanteFilterChange,
  solicitanteOptions = [],
  solicitanteLoading = false,
  statusOptions,
  searchPlaceholder = 'Proyecto, cliente, destinatario u oferta...',
  animateEnter = true,
}: FilterBarProps) {
  const uid = useId();
  const panelId = `${uid}-panel`;
  const statusFieldId = `${uid}-status`;
  const searchFieldId = `${uid}-search`;
  const solicitanteFieldId = `${uid}-solicitante`;

  const showSolicitante = Boolean(onSolicitanteFilterChange);
  const hasSolicitanteOptions = solicitanteOptions.length > 0;
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const resolvedStatusOptions = statusOptions ?? ACTIVATION_STATUS_OPTIONS;

  const hasActiveFilters =
    statusFilter !== '' ||
    solicitanteFilter !== '' ||
    searchValue.trim() !== '';

  const clearFilters = () => {
    onStatusFilterChange('');
    onSolicitanteFilterChange?.('');
    onSearchChange?.('');
  };

  const rootClass = [
    animateEnter ? 'app-enter' : null,
    styles.root,
    embedded ? styles.rootEmbedded : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const barClass = [styles.bar, embedded ? styles.barEmbedded : null, mobileFiltersOpen ? styles.barExpanded : null]
    .filter(Boolean)
    .join(' ');

  const fieldClass = (extra?: string) =>
    [styles.field, embedded ? styles.fieldEmbedded : null, extra].filter(Boolean).join(' ');

  return (
    <div className={rootClass}>
      {embedded && (
        <div className={styles.embeddedHeader}>
          <h2 className={styles.embeddedTitle}>Filtros</h2>
          {hasActiveFilters ? (
            <button type="button" className={styles.clearBtn} onClick={clearFilters}>
              Limpiar filtros
            </button>
          ) : null}
        </div>
      )}
      <button
        type="button"
        className={embedded ? `${styles.mobileToggle} ${styles.mobileToggleEmbedded}` : styles.mobileToggle}
        onClick={() => setMobileFiltersOpen((v) => !v)}
        aria-expanded={mobileFiltersOpen}
        aria-controls={panelId}
      >
        {mobileFiltersOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
      </button>
      <div id={panelId} className={barClass} role="search">
        <div className={fieldClass()}>
          <label className={styles.label} htmlFor={statusFieldId}>
            Estado
          </label>
          <div className={embedded ? styles.controlWrap : undefined}>
            <select
              id={statusFieldId}
              className={embedded ? `${styles.select} ${styles.selectStyled}` : styles.select}
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              aria-label="Filtrar por estado"
            >
              {resolvedStatusOptions.map((opt) => (
                <option key={opt.value === '' ? `${uid}-all` : opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {embedded ? (
              <span className={styles.selectChevron}>
                <SelectChevron />
              </span>
            ) : null}
          </div>
        </div>
        {showSolicitante && (
          <div className={fieldClass(styles.fieldSolicitante)}>
            <label className={styles.label} htmlFor={solicitanteFieldId}>
              Solicitante
            </label>
            <div className={embedded ? styles.controlWrap : undefined}>
              <select
                id={solicitanteFieldId}
                className={
                  embedded
                    ? `${styles.select} ${styles.selectStyled} ${styles.selectSolicitante}`
                    : `${styles.select} ${styles.selectSolicitante}`
                }
                value={solicitanteFilter}
                onChange={(e) => onSolicitanteFilterChange?.(e.target.value)}
                aria-label="Filtrar por solicitante"
                disabled={solicitanteLoading || !hasSolicitanteOptions}
              >
                <option value="">Todos</option>
                {solicitanteLoading && <option value="" disabled>Cargando solicitantes...</option>}
                {!solicitanteLoading && !hasSolicitanteOptions && (
                  <option value="" disabled>No disponible</option>
                )}
                {solicitanteOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {getSolicitanteLabel(u)}
                  </option>
                ))}
              </select>
              {embedded ? (
                <span className={styles.selectChevron}>
                  <SelectChevron />
                </span>
              ) : null}
            </div>
          </div>
        )}
        {onSearchChange && (
          <div className={fieldClass(styles.fieldSearch)}>
            <label className={styles.label} htmlFor={searchFieldId}>
              Buscar
            </label>
            <div className={embedded ? styles.searchWrap : undefined}>
              {embedded ? (
                <span className={styles.searchIcon} aria-hidden>
                  <SearchIcon />
                </span>
              ) : null}
              <input
                id={searchFieldId}
                type="search"
                className={embedded ? `${styles.input} ${styles.inputSearch}` : styles.input}
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                aria-label="Buscar"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
