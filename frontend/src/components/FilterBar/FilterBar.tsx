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
}

function getSolicitanteLabel(u: SolicitanteOption): string {
  const full = [u.name, u.lastName].filter(Boolean).join(' ').trim();
  return full || u.email;
}

export function FilterBar({
  className,
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

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <button
        type="button"
        className={styles.mobileToggle}
        onClick={() => setMobileFiltersOpen((v) => !v)}
        aria-expanded={mobileFiltersOpen}
        aria-controls={panelId}
      >
        {mobileFiltersOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
      </button>
      <div
        id={panelId}
        className={`${styles.bar} ${mobileFiltersOpen ? styles.barExpanded : ''}`}
        role="search"
      >
        <div className={styles.field}>
          <label className={styles.label} htmlFor={statusFieldId}>
            Estado
          </label>
          <select
            id={statusFieldId}
            className={styles.select}
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
        </div>
        {showSolicitante && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor={solicitanteFieldId}>
              Solicitante
            </label>
            <select
              id={solicitanteFieldId}
              className={`${styles.select} ${styles.selectSolicitante}`}
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
          </div>
        )}
        {onSearchChange && (
          <div className={`${styles.field} ${styles.fieldSearch}`}>
            <label className={styles.label} htmlFor={searchFieldId}>
              Buscar
            </label>
            <input
              id={searchFieldId}
              type="search"
              className={styles.input}
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Buscar"
            />
          </div>
        )}
      </div>
    </div>
  );
}
