'use client';

import styles from './DataTable.module.css';

export interface Column<T> {
  key: string;
  /** Texto por defecto del encabezado; se ignora en `<th>` si existe `renderHeader`. */
  header: string;
  /** Si se define, sustituye el contenido del `<th>` (p. ej. título + control global). */
  renderHeader?: () => React.ReactNode;
  /** Ancho mínimo en píxeles para `<th>` y `<td>` de esta columna. */
  minWidthPx?: number;
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  columns,
  data,
  loading,
  emptyMessage = 'No hay datos.',
  getRowId,
  onRowClick,
}: DataTableProps<T>) {
  if (loading) {
    const skeletonRows = 6;
    const skeletonGridStyle = { gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(4rem, 1fr))` };
    return (
      <div className={styles.wrap}>
        <div className={styles.loading} role="status" aria-live="polite">
          <div className={styles.skeletonHeader} style={skeletonGridStyle}>
            {columns.map((col) => (
              <span key={`header-${col.key}`} className={styles.skeletonHeaderCell} />
            ))}
          </div>
          <div className={styles.skeletonBody}>
            {Array.from({ length: skeletonRows }).map((_, rowIndex) => (
              <div key={`row-${rowIndex}`} className={styles.skeletonRow} style={skeletonGridStyle}>
                {columns.map((col) => (
                  <span key={`cell-${rowIndex}-${col.key}`} className={styles.skeletonCell} />
                ))}
              </div>
            ))}
          </div>
          <span className={styles.loadingText}>Cargando datos...</span>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={styles.wrap}>
        <div className={styles.empty}>{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={styles.th}
                scope="col"
                style={col.minWidthPx != null ? { minWidth: `${col.minWidthPx}px` } : undefined}
              >
                {col.renderHeader ? col.renderHeader() : col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={getRowId(row)}
              className={`${styles.tr} ${onRowClick ? styles.trClickable : ''}`}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={styles.td}
                  style={col.minWidthPx != null ? { minWidth: `${col.minWidthPx}px` } : undefined}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
