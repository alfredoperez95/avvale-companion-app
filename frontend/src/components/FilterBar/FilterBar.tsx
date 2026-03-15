'use client';

import styles from './FilterBar.module.css';

interface FilterBarProps {
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
}

export function FilterBar({
  statusFilter,
  onStatusFilterChange,
  searchValue = '',
  onSearchChange,
}: FilterBarProps) {
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
        <option value="READY_TO_SEND">Listo para enviar</option>
        <option value="SENT">Enviado</option>
        <option value="ERROR">Error</option>
      </select>
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
