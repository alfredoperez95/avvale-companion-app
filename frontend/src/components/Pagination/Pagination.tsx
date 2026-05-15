'use client';

import styles from './Pagination.module.css';

export type PaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageStart: number;
  pageEnd: number;
  totalItems: number;
  itemLabel?: string;
  itemLabelSingular?: string;
  className?: string;
};

function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [1];

  if (current > 3) pages.push('ellipsis');

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let p = start; p <= end; p += 1) {
    pages.push(p);
  }

  if (current < total - 2) pages.push('ellipsis');

  pages.push(total);
  return pages;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  pageStart,
  pageEnd,
  totalItems,
  itemLabel = 'registros',
  itemLabelSingular,
  className,
}: PaginationProps) {
  if (totalItems === 0) return null;

  const pages = getPageNumbers(page, totalPages);
  const rootClass = [styles.root, className].filter(Boolean).join(' ');
  const countLabel = totalItems === 1 ? (itemLabelSingular ?? itemLabel) : itemLabel;

  return (
    <nav className={rootClass} aria-label="Paginación">
      <p className={styles.summary}>
        Mostrando <strong>{pageStart}</strong>–<strong>{pageEnd}</strong> de{' '}
        <strong>{totalItems}</strong> {countLabel}
      </p>
      {totalPages > 1 ? (
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Página anterior"
          >
            Anterior
          </button>
          <ul className={styles.pageList} role="list">
            {pages.map((p, index) =>
              p === 'ellipsis' ? (
                <li key={`ellipsis-${index}`} className={styles.ellipsis} aria-hidden>
                  …
                </li>
              ) : (
                <li key={p}>
                  <button
                    type="button"
                    className={p === page ? styles.pageBtnActive : styles.pageBtn}
                    onClick={() => onPageChange(p)}
                    aria-label={`Página ${p}`}
                    aria-current={p === page ? 'page' : undefined}
                  >
                    {p}
                  </button>
                </li>
              ),
            )}
          </ul>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Página siguiente"
          >
            Siguiente
          </button>
        </div>
      ) : null}
    </nav>
  );
}
