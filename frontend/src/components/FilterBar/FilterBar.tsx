'use client';

import styles from './FilterBar.module.css';

export type SolicitanteOption = { id: string; name?: string | null; lastName?: string | null; email: string };

interface FilterBarProps {
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  solicitanteFilter?: string;
  onSolicitanteFilterChange?: (userId: string) => void;
  solicitanteOptions?: SolicitanteOption[];
  solicitanteLoading?: boolean;
}

function getSolicitanteLabel(u: SolicitanteOption): string {
  const full = [u.name, u.lastName].filter(Boolean).join(' ').trim();
  return full || u.email;
}

export function FilterBar({
  statusFilter,
  onStatusFilterChange,
  searchValue = '',
  onSearchChange,
  solicitanteFilter = '',
  onSolicitanteFilterChange,
  solicitanteOptions = [],
  solicitanteLoading = false,
}: FilterBarProps) {
  const showSolicitante = Boolean(onSolicitanteFilterChange);
  const hasSolicitanteOptions = solicitanteOptions.length > 0;

  return (
    <div className={styles.bar} role="search">
      <label className={styles.label} htmlFor="filter-status">
        Estado
      </label>
      <select
        id="filter-status"
        className={styles.select}
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value)}
        aria-label="Filtrar por estado"
      >
        <option value="">Todos</option>
        <option value="DRAFT">Borrador</option>
        <option value="QUEUED">En cola</option>
        <option value="PROCESSING">Procesando</option>
        <option value="RETRYING">Reintentando</option>
        <option value="PENDING_CALLBACK">Esperando Make</option>
        <option value="SENT">Enviado</option>
        <option value="FAILED">Error envío</option>
      </select>
      {showSolicitante && (
        <>
          <label className={styles.label} htmlFor="filter-solicitante">
            Solicitante
          </label>
          <select
            id="filter-solicitante"
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
        </>
      )}
      {onSearchChange && (
        <>
          <label className={styles.label} htmlFor="filter-search">
            Buscar
          </label>
          <input
            id="filter-search"
            type="search"
            className={styles.input}
            placeholder="Proyecto, cliente o destinatario..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Buscar"
          />
        </>
      )}
    </div>
  );
}
