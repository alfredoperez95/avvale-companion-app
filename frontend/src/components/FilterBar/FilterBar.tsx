'use client';

import { useEffect } from 'react';
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

  useEffect(() => {
    const solicitanteEl = document.getElementById('filter-solicitante') as HTMLSelectElement | null;
    const barEl = solicitanteEl?.closest('[role="search"]') as HTMLElement | null;
    const style = solicitanteEl ? window.getComputedStyle(solicitanteEl) : null;
    const barStyle = barEl ? window.getComputedStyle(barEl) : null;
    // #region agent log
    fetch('http://127.0.0.1:7401/ingest/4ab151b9-cbda-4400-a5db-364c7cddddff',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e790b2'},body:JSON.stringify({sessionId:'e790b2',runId:'pre-fix',hypothesisId:'H1',location:'FilterBar.tsx:38',message:'solicitante-width-snapshot',data:{showSolicitante,solicitanteLoading,optionsCount:solicitanteOptions.length,disabled:solicitanteEl?.disabled ?? null,theme:document.documentElement.getAttribute('data-appearance'),offsetWidth:solicitanteEl?.offsetWidth ?? null,clientWidth:solicitanteEl?.clientWidth ?? null,computedWidth:style?.width ?? null,minWidth:style?.minWidth ?? null,flexBasis:style?.flexBasis ?? null,barGap:barStyle?.gap ?? null,barWrap:barStyle?.flexWrap ?? null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, [showSolicitante, solicitanteLoading, solicitanteOptions.length]);

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
        <option value="READY_TO_SEND">Envío iniciado</option>
        <option value="SENT">Enviado</option>
        <option value="ERROR">Error</option>
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
