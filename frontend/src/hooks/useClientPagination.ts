'use client';

import { useEffect, useMemo, useState } from 'react';

export const ACTIVATIONS_PAGE_SIZE = 10;

export function useClientPagination<T>(
  items: T[],
  pageSize: number = ACTIVATIONS_PAGE_SIZE,
  /** Cambia al modificar filtros/búsqueda para volver a la página 1. */
  resetKey?: string,
) {
  const [page, setPage] = useState(1);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  const pageStart = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const pageEnd = Math.min(safePage * pageSize, totalItems);

  return {
    page: safePage,
    setPage,
    totalPages,
    pageSize,
    totalItems,
    paginatedItems,
    pageStart,
    pageEnd,
    showPagination: totalItems > pageSize,
  };
}
