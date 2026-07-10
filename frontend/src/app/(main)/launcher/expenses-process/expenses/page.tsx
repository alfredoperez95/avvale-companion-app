'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch, redirectToLogin } from '@/lib/api';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { PageBreadcrumb, PageBackLink, PageHero } from '@/components/page-hero';
import {
  ArrowCounterclockwiseRegular,
  CalendarMonthRegular,
  CalendarRegular,
  CheckmarkRegular,
  DismissRegular,
  FilterRegular,
  MoneyRegular,
  TagRegular,
} from '@fluentui/react-icons';
import {
  EXPENSE_CATEGORIES,
  ExpenseAttachmentIcon,
  ExpenseCategoryIcon,
  ExpenseDeleteIcon,
  isExpenseCategory,
} from '../expense-categories';
import styles from '../expenses-process.module.css';

type Expense = {
  id: string;
  amount: number | null;
  type: string | null;
  description: string | null;
  date: string | null;
  paidByCompany: boolean;
  loaded?: boolean;
  fileUrl: string;
  originalFileName: string;
  mimeType: string;
  status: 'pending_review' | 'processed';
  extractionError?: string | null;
};

type MonthGroup = {
  key: string;
  label: string;
  total: number;
  items: Expense[];
};

type AmountSort = 'desc' | 'asc';

type ExpensesImportPayload = {
  expenses: Array<{
    id: string;
    fecha: string;
    importe: number | string;
    tipo: string;
    descripcion: string;
    estado: 'processed';
    nombre_archivo: string;
    url_recibo: string;
    caduca_en: string;
    paid_by_company: boolean;
  }>;
  meta?: {
    source?: string;
    batchId?: string;
  };
};

type ExpensesImportResult =
  | { ok: true; jobId?: string; count?: number; tabId?: number }
  | {
      ok: true;
      phase: 'completed';
      type: 'EXPENSES_IMPORT_COMPLETED';
      jobId?: string;
      count?: number;
      imported?: number;
      failed?: number;
      skipped?: number;
      loadedIds?: string[];
      expenses?: Array<{ id: string; loaded: boolean; error?: string }>;
      meta?: unknown;
      report?: unknown;
    }
  | { ok: false; error?: string };

const PENDING_TYPE_FILTER = '__pending__';
const EXPENSES_IMPORT_START_EVENT = 'avvale-companion-expenses-import-start';
const EXPENSES_IMPORT_RESULT_EVENT = 'avvale-companion-expenses-import-result';

const MONTH_OPTIONS = [
  { value: '', label: 'Todos' },
  ...Array.from({ length: 12 }, (_, index) => ({
    value: String(index + 1),
    label: new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(new Date(2024, index, 1)),
  })),
];

export default function ExpensesPage() {
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Expense | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [amountRange, setAmountRange] = useState<[number, number]>([0, 100]);
  const [amountSort, setAmountSort] = useState<AmountSort>('desc');
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const [sendingKey, setSendingKey] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/expenses')
      .then(async (res) => {
        if (res.status === 401) {
          redirectToLogin();
          return null;
        }
        if (!res.ok) throw new Error('No se pudieron cargar los gastos.');
        return (await res.json()) as { items?: Expense[] };
      })
      .then((data) => {
        if (!cancelled && data) setItems(data.items ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudieron cargar los gastos.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleImportResult(event: Event) {
      const result = (event as CustomEvent<ExpensesImportResult>).detail;
      if (!isCompletedImportResult(result)) return;

      const statusUpdates = normalizeImportStatusUpdates(result);
      if (!statusUpdates.length) {
        setExportMessage('Importación finalizada, pero la extensión no devolvió estados de carga.');
        return;
      }

      apiFetch('/api/expenses/import-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenses: statusUpdates }),
      })
        .then(async (res) => {
          if (res.status === 401) {
            redirectToLogin();
            return null;
          }
          if (!res.ok) {
            const text = await res.text();
            throw new Error(text || 'No se pudo actualizar el estado de carga.');
          }
          return res.json();
        })
        .then((data) => {
          if (!data) return;
          const loadedById = new Map(statusUpdates.map((expense) => [expense.id, expense.loaded]));
          setItems((current) =>
            current.map((expense) =>
              loadedById.has(expense.id) ? { ...expense, loaded: loadedById.get(expense.id) ?? false } : expense,
            ),
          );
          const imported = result.imported ?? statusUpdates.filter((expense) => expense.loaded).length;
          const failed = result.failed ?? statusUpdates.filter((expense) => !expense.loaded).length;
          setExportMessage(`Importación finalizada. Cargados: ${imported}. Fallidos/no cargados: ${failed}.`);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'No se pudo actualizar el estado de carga.');
        });
    }

    document.addEventListener(EXPENSES_IMPORT_RESULT_EVENT, handleImportResult);
    return () => document.removeEventListener(EXPENSES_IMPORT_RESULT_EVENT, handleImportResult);
  }, []);

  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    for (const expense of items) {
      const date = parseExpenseDate(expense.date);
      if (date) years.add(date.getFullYear());
    }
    return [...years].sort((a, b) => b - a);
  }, [items]);

  const amountBounds = useMemo(() => computeAmountBounds(items), [items]);
  const amountStep = useMemo(
    () => computeRangeStep(amountBounds.min, amountBounds.max),
    [amountBounds.min, amountBounds.max],
  );

  useEffect(() => {
    setAmountRange([amountBounds.min, amountBounds.max]);
  }, [amountBounds.min, amountBounds.max]);

  const hasAmountFilter =
    amountRange[0] > amountBounds.min || amountRange[1] < amountBounds.max;

  const hasActiveFilters =
    typeFilter !== '' || yearFilter !== '' || monthFilter !== '' || hasAmountFilter;

  const filteredItems = useMemo(() => {
    return items.filter((expense) =>
      matchesFilters(expense, {
        typeFilter,
        yearFilter,
        monthFilter,
        minAmount: hasAmountFilter ? amountRange[0] : null,
        maxAmount: hasAmountFilter ? amountRange[1] : null,
      }),
    );
  }, [items, typeFilter, yearFilter, monthFilter, amountRange, hasAmountFilter]);

  const groups = useMemo(
    () => groupExpensesByMonth(filteredItems, amountSort),
    [filteredItems, amountSort],
  );

  const filteredTotal = useMemo(
    () => filteredItems.reduce((sum, expense) => sum + (expense.amount ?? 0), 0),
    [filteredItems],
  );

  const clearFilters = () => {
    setTypeFilter('');
    setYearFilter('');
    setMonthFilter('');
    setAmountRange([amountBounds.min, amountBounds.max]);
  };

  const toggleAmountSort = () => {
    setAmountSort((current) => (current === 'desc' ? 'asc' : 'desc'));
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleteBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/expenses/${toDelete.id}`, { method: 'DELETE' });
      if (res.status === 401) {
        redirectToLogin();
        return;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'No se pudo eliminar el gasto.');
      }
      setItems((prev) => prev.filter((item) => item.id !== toDelete.id));
      setToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el gasto.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const generateMonthExport = async (group: MonthGroup) => {
    const [yearPart, monthPart] = group.key.split('-');
    const year = Number(yearPart);
    const month = Number(monthPart);
    if (!year || !month) {
      setError('No se pudo identificar el mes a exportar.');
      return;
    }

    setGeneratingKey(group.key);
    setError(null);
    setExportMessage(null);

    try {
      const res = await apiFetch('/api/expenses/exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year,
          month,
          expenseIds: group.items.map((expense) => expense.id),
        }),
      });
      if (res.status === 401) {
        redirectToLogin();
        return;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'No se pudo generar el CSV.');
      }

      const blob = await res.blob();
      const fileName = fileNameFromContentDisposition(res.headers.get('Content-Disposition')) ?? `gastos-${group.key}.csv`;
      downloadBlob(blob, fileName);

      const expiresAt = res.headers.get('X-Export-Expires-At');
      const expiresText = formatExportExpiry(expiresAt);
      setExportMessage(
        expiresText
          ? `CSV generado. Los enlaces a recibos estarán disponibles hasta ${expiresText}.`
          : 'CSV generado. Los enlaces a recibos estarán disponibles durante unas horas.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el CSV.');
    } finally {
      setGeneratingKey(null);
    }
  };

  const sendMonthToAvvale = async (group: MonthGroup) => {
    const processedItems = group.items.filter((expense) => expense.status === 'processed');
    if (!processedItems.length) {
      setError('No hay gastos procesados en este mes para enviar a Avvale Time Report.');
      return;
    }

    const [yearPart, monthPart] = group.key.split('-');
    const year = Number(yearPart);
    const month = Number(monthPart);
    if (!year || !month) {
      setError('No se pudo identificar el mes a enviar.');
      return;
    }

    setSendingKey(group.key);
    setError(null);
    setExportMessage(null);

    try {
      const res = await apiFetch('/api/expenses/import-payload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year,
          month,
          expenseIds: processedItems.map((expense) => expense.id),
        }),
      });
      if (res.status === 401) {
        redirectToLogin();
        return;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'No se pudo preparar el envío a Avvale Time Report.');
      }

      const data = (await res.json()) as { payload?: ExpensesImportPayload; expiresAt?: string };
      if (!data.payload?.expenses?.length) {
        throw new Error('No hay gastos procesados para enviar a Avvale Time Report.');
      }

      const result = await dispatchExpensesImport(data.payload);
      if (!result.ok) {
        throw new Error(result.error || 'La extensión no pudo iniciar la importación.');
      }

      const count = result.count ?? data.payload.expenses.length;
      setExportMessage(
        count === 1
          ? 'Import started in Avvale Time Report para 1 gasto.'
          : `Import started in Avvale Time Report para ${count} gastos.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar a Avvale Time Report.');
    } finally {
      setSendingKey(null);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageIntro}>
        <PageBreadcrumb>
          <PageBackLink href="/launcher">← App Launcher</PageBackLink>
        </PageBreadcrumb>
        <PageHero
          animateEnter={false}
          title="Gastos"
          subtitle="Gastos guardados por mes, con recibo persistente disponible para revisión y futura automatización."
          actions={
            <Link href="/launcher/expenses-process/expenses/new" className={styles.toolbarLink}>
              Nuevo gasto
            </Link>
          }
        />
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}
      {exportMessage ? <div className={styles.success}>{exportMessage}</div> : null}

      {!loading ? (
        <section className={`${styles.filtersCard} ${filtersOpen ? styles.filtersCardOpen : ''}`} aria-label="Filtros de gastos">
          <header className={styles.filtersHeader}>
            <div className={styles.filtersHeaderMain}>
              <h2 className={styles.filtersTitle}>
                <FilterRegular fontSize={18} aria-hidden />
                Filtros
              </h2>
              {hasActiveFilters ? <span className={styles.filtersBadge}>Activos</span> : null}
            </div>
            <div className={styles.filtersHeaderAside}>
              <div className={styles.filtersStats} aria-live="polite">
                <span className={styles.filtersStatChip}>
                  <strong>{filteredItems.length}</strong> {filteredItems.length === 1 ? 'gasto' : 'gastos'}
                </span>
                <span className={`${styles.filtersStatChip} ${styles.filtersStatChipAccent}`}>
                  Total <strong>{formatCurrency(filteredTotal)}</strong>
                </span>
              </div>
              <button
                type="button"
                className={styles.filtersToggleBtn}
                aria-expanded={filtersOpen}
                aria-controls="expenses-filters-panel"
                onClick={() => setFiltersOpen((current) => !current)}
              >
                {filtersOpen ? 'Ocultar filtros' : hasActiveFilters ? 'Editar filtros' : 'Mostrar filtros'}
              </button>
              {hasActiveFilters ? (
                <button type="button" className={styles.filtersClearBtn} onClick={clearFilters}>
                  <ArrowCounterclockwiseRegular fontSize={16} aria-hidden />
                  Limpiar
                </button>
              ) : null}
            </div>
          </header>

          {filtersOpen ? (
          <div id="expenses-filters-panel" className={styles.filtersBar}>
            <div className={`${styles.filtersBarCell} ${typeFilter ? styles.filtersBarCellActive : ''}`}>
              <label className={styles.filtersBarLabel} htmlFor="expense-filter-type">
                <TagRegular fontSize={14} aria-hidden />
                Tipología
              </label>
              <select
                id="expense-filter-type"
                className={`${styles.select} ${styles.filtersNativeControl}`}
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
              >
                <option value="">Todas</option>
                <option value={PENDING_TYPE_FILTER}>Pendiente de revisar</option>
                {EXPENSE_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filtersBarDivider} aria-hidden="true" />

            <div className={`${styles.filtersBarCell} ${styles.filtersBarCellCompact} ${yearFilter ? styles.filtersBarCellActive : ''}`}>
              <label className={styles.filtersBarLabel} htmlFor="expense-filter-year">
                <CalendarRegular fontSize={14} aria-hidden />
                Año
              </label>
              <select
                id="expense-filter-year"
                className={`${styles.select} ${styles.filtersNativeControl}`}
                value={yearFilter}
                onChange={(event) => setYearFilter(event.target.value)}
              >
                <option value="">Todos</option>
                {yearOptions.map((year) => (
                  <option key={year} value={String(year)}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filtersBarDivider} aria-hidden="true" />

            <div className={`${styles.filtersBarCell} ${styles.filtersBarCellCompact} ${monthFilter ? styles.filtersBarCellActive : ''}`}>
              <label className={styles.filtersBarLabel} htmlFor="expense-filter-month">
                <CalendarMonthRegular fontSize={14} aria-hidden />
                Mes
              </label>
              <select
                id="expense-filter-month"
                className={`${styles.select} ${styles.filtersNativeControl}`}
                value={monthFilter}
                onChange={(event) => setMonthFilter(event.target.value)}
              >
                {MONTH_OPTIONS.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filtersBarDivider} aria-hidden="true" />

            <div
              className={`${styles.filtersBarCell} ${styles.filtersBarCellRange} ${hasAmountFilter ? styles.filtersBarCellActive : ''}`}
              aria-labelledby="expense-filter-amount-label"
            >
              <span className={styles.filtersBarLabel} id="expense-filter-amount-label">
                <MoneyRegular fontSize={14} aria-hidden />
                Rango de importes
              </span>
              <div className={styles.rangeInline}>
                <output className={styles.rangePill} htmlFor="expense-filter-amount-low expense-filter-amount-high">
                  {formatCurrency(amountRange[0])}
                </output>
                <AmountRangeSelector
                  min={amountBounds.min}
                  max={amountBounds.max}
                  step={amountStep}
                  value={amountRange}
                  onChange={setAmountRange}
                  lowInputId="expense-filter-amount-low"
                  highInputId="expense-filter-amount-high"
                />
                <output className={styles.rangePill} htmlFor="expense-filter-amount-low expense-filter-amount-high">
                  {formatCurrency(amountRange[1])}
                </output>
              </div>
              <p className={styles.rangeFootnote}>
                Disponible {formatCurrency(amountBounds.min)} – {formatCurrency(amountBounds.max)}
              </p>
            </div>
          </div>
          ) : null}
        </section>
      ) : null}

      {loading ? <div className={styles.stateCard}>Cargando gastos…</div> : null}
      {!loading && items.length === 0 ? (
        <div className={styles.stateCard}>No hay gastos guardados todavía. Crea el primero con “Nuevo gasto”.</div>
      ) : null}
      {!loading && items.length > 0 && filteredItems.length === 0 ? (
        <div className={styles.stateCard}>No hay gastos que coincidan con los filtros seleccionados.</div>
      ) : null}

      <div className={styles.monthsList}>
        {groups.map((group) => (
          <section key={group.key} className={styles.monthCard} aria-labelledby={`month-${group.key}`}>
            <header className={styles.monthHeader}>
              <div className={styles.monthHeaderMain}>
                <h2 id={`month-${group.key}`} className={styles.monthTitle}>
                  {capitalizeMonthLabel(group.label)}
                </h2>
                <span className={styles.monthCount}>
                  {group.items.length} {group.items.length === 1 ? 'gasto' : 'gastos'}
                </span>
              </div>
              <div className={styles.monthHeaderAside}>
                <span className={styles.monthTotalPill}>{formatCurrency(group.total)}</span>
                <button
                  type="button"
                  className={styles.monthGenerateButton}
                  onClick={() => void generateMonthExport(group)}
                  disabled={generatingKey !== null || sendingKey !== null}
                >
                  {generatingKey === group.key ? 'Generando…' : 'Generar'}
                </button>
                <button
                  type="button"
                  className={`${styles.monthGenerateButton} ${styles.monthSendButton}`}
                  onClick={() => void sendMonthToAvvale(group)}
                  disabled={generatingKey !== null || sendingKey !== null || !group.items.some((expense) => expense.status === 'processed')}
                >
                  {sendingKey === group.key ? 'Enviando…' : 'Enviar'}
                </button>
              </div>
            </header>
            <div className={styles.expenseTableHead} aria-hidden="true">
              <span>Fecha</span>
              <span>Tipología</span>
              <span className={styles.expenseTableHeadPaid}>Paid company</span>
              <span className={styles.expenseTableHeadLoaded}>Cargado</span>
              <button
                type="button"
                className={`${styles.sortButton} ${styles.sortButtonActive}`}
                onClick={toggleAmountSort}
                aria-label={amountSort === 'desc' ? 'Ordenar importe de mayor a menor' : 'Ordenar importe de menor a mayor'}
              >
                Importe
                <SortIcon direction={amountSort} />
              </button>
              <span className={styles.expenseTableHeadActions}>Acciones</span>
            </div>
            <ul className={styles.expenseList}>
              {group.items.map((expense) => {
                const dateParts = formatDateParts(expense.date);
                const pendingReview = !expense.type;
                const showCategoryIcon = !pendingReview && isExpenseCategory(expense.type);
                const loaded = expense.loaded ?? false;
                return (
                  <li key={expense.id} className={styles.expenseRow}>
                    <Link
                      href={`/launcher/expenses-process/expenses/${expense.id}`}
                      className={styles.expenseRowLink}
                      aria-label={`Ver gasto del ${formatDate(expense.date)}`}
                    >
                      <span className={styles.expenseDate} aria-hidden="true">
                        <span
                          className={`${styles.expenseDateCalendar} ${dateParts.empty ? styles.expenseDateCalendarEmpty : ''}`}
                        >
                          <span className={styles.expenseDateMonth}>{dateParts.month}</span>
                          <span className={styles.expenseDateDay}>{dateParts.day}</span>
                          <span className={styles.expenseDateYear}>{dateParts.year}</span>
                        </span>
                      </span>
                      <span
                        className={`${styles.expenseTypeCell} ${showCategoryIcon ? '' : styles.expenseTypeCellNoIcon}`}
                      >
                        {showCategoryIcon ? (
                          <ExpenseCategoryIcon category={expense.type} className={styles.expenseTypeIcon} />
                        ) : null}
                        <span className={styles.expenseTypeMeta}>
                          {pendingReview ? (
                            <span className={`${styles.expenseType} ${styles.expenseTypePending}`}>
                              Pendiente de revisar
                            </span>
                          ) : (
                            <span className={styles.expenseType}>{expense.type}</span>
                          )}
                          {expense.description ? (
                            <span className={styles.expenseDescription}>{expense.description}</span>
                          ) : null}
                        </span>
                      </span>
                      <span
                        className={`${styles.expensePaidBadge} ${
                          expense.paidByCompany ? styles.expensePaidBadgeActive : styles.expensePaidBadgeInactive
                        }`}
                      >
                        {expense.paidByCompany ? 'Sí' : 'No'}
                      </span>
                      <span
                        className={`${styles.expenseLoadedBadge} ${
                          loaded ? styles.expenseLoadedBadgeActive : styles.expenseLoadedBadgeInactive
                        }`}
                        aria-label={loaded ? 'Cargado: true' : 'Cargado: false'}
                        title={loaded ? 'Cargado: true' : 'Cargado: false'}
                      >
                        {loaded ? <CheckmarkRegular fontSize={15} aria-hidden /> : <DismissRegular fontSize={15} aria-hidden />}
                      </span>
                      <span className={styles.expenseAmount}>{formatCurrency(expense.amount ?? 0)}</span>
                    </Link>
                    <div className={styles.expenseActions}>
                      <Link
                        href={`/launcher/expenses-process/expenses/${expense.id}`}
                        className={styles.iconAction}
                        title={expense.originalFileName}
                        aria-label={`Ver recibo ${expense.originalFileName}`}
                      >
                        <ExpenseAttachmentIcon />
                      </Link>
                      <button
                        type="button"
                        className={`${styles.iconAction} ${styles.iconActionDanger}`}
                        title="Eliminar gasto"
                        aria-label="Eliminar gasto"
                        onClick={() => setToDelete(expense)}
                      >
                        <ExpenseDeleteIcon />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        title="Eliminar gasto"
        message={
          toDelete
            ? `¿Eliminar el gasto del ${formatDate(toDelete.date)} (${formatCurrency(toDelete.amount ?? 0)})? Se borrará también el recibo adjunto. Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar"
        variant="danger"
        confirmBusy={deleteBusy}
        busyLabel="Eliminando…"
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          if (!deleteBusy) setToDelete(null);
        }}
      />
    </div>
  );
}

function matchesFilters(
  expense: Expense,
  filters: {
    typeFilter: string;
    yearFilter: string;
    monthFilter: string;
    minAmount: number | null;
    maxAmount: number | null;
  },
): boolean {
  if (filters.typeFilter) {
    if (filters.typeFilter === PENDING_TYPE_FILTER) {
      if (expense.type) return false;
    } else if (expense.type !== filters.typeFilter) {
      return false;
    }
  }

  const date = parseExpenseDate(expense.date);
  if (filters.yearFilter || filters.monthFilter) {
    if (!date) return false;
    if (filters.yearFilter && date.getFullYear() !== Number(filters.yearFilter)) return false;
    if (filters.monthFilter && date.getMonth() + 1 !== Number(filters.monthFilter)) return false;
  }

  const amount = expense.amount ?? 0;
  if (filters.minAmount != null && amount < filters.minAmount) return false;
  if (filters.maxAmount != null && amount > filters.maxAmount) return false;

  return true;
}

function computeAmountBounds(items: Expense[]): { min: number; max: number } {
  if (!items.length) return { min: 0, max: 100 };

  let min = Infinity;
  let max = -Infinity;
  for (const expense of items) {
    const amount = expense.amount ?? 0;
    min = Math.min(min, amount);
    max = Math.max(max, amount);
  }

  min = Math.floor(min);
  max = Math.ceil(max);
  if (max <= min) max = min + 1;
  return { min, max };
}

function computeRangeStep(min: number, max: number): number {
  const span = max - min;
  if (span <= 0) return 1;
  if (span <= 50) return 0.5;
  if (span <= 200) return 1;
  if (span <= 1000) return 5;
  return Math.ceil(span / 200);
}

function clampRangeValue(value: number, min: number, max: number, step: number): number {
  const clamped = Math.min(max, Math.max(min, value));
  const steps = Math.round((clamped - min) / step);
  return Math.min(max, Math.max(min, min + steps * step));
}

function sortExpenses(items: Expense[], amountSort: AmountSort): Expense[] {
  return [...items].sort((a, b) => {
    const diff = (a.amount ?? 0) - (b.amount ?? 0);
    if (diff !== 0) return amountSort === 'desc' ? -diff : diff;

    const dateA = parseExpenseDate(a.date)?.getTime() ?? 0;
    const dateB = parseExpenseDate(b.date)?.getTime() ?? 0;
    return dateB - dateA;
  });
}

function groupExpensesByMonth(items: Expense[], amountSort: AmountSort): MonthGroup[] {
  const map = new Map<string, MonthGroup>();
  for (const expense of items) {
    const date = parseExpenseDate(expense.date) ?? new Date();
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const existing =
      map.get(key) ??
      ({
        key,
        label: new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(date),
        total: 0,
        items: [],
      } satisfies MonthGroup);
    existing.total += expense.amount ?? 0;
    existing.items.push(expense);
    map.set(key, existing);
  }

  return [...map.values()]
    .map((group) => ({
      ...group,
      items: sortExpenses(group.items, amountSort),
    }))
    .sort((a, b) => (a.key < b.key ? 1 : -1));
}

function parseExpenseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(value: string | null): string {
  const date = parseExpenseDate(value);
  if (!date) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function formatDateParts(value: string | null): {
  day: string;
  month: string;
  year: string;
  empty: boolean;
} {
  const date = parseExpenseDate(value);
  if (!date) {
    return { day: '—', month: '—', year: '—', empty: true };
  }

  const month = new Intl.DateTimeFormat('es-ES', { month: 'short' })
    .format(date)
    .replace(/\.$/, '');

  return {
    day: new Intl.DateTimeFormat('es-ES', { day: '2-digit' }).format(date),
    month,
    year: new Intl.DateTimeFormat('es-ES', { year: 'numeric' }).format(date),
    empty: false,
  };
}

function capitalizeMonthLabel(label: string): string {
  if (!label) return label;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
}

function fileNameFromContentDisposition(value: string | null): string | null {
  if (!value) return null;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(value)?.[1];
  if (encoded) return decodeURIComponent(encoded);
  return /filename="([^"]+)"/i.exec(value)?.[1] ?? null;
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function formatExportExpiry(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function isCompletedImportResult(result: ExpensesImportResult | undefined): result is Extract<
  ExpensesImportResult,
  { phase: 'completed'; type: 'EXPENSES_IMPORT_COMPLETED' }
> {
  return Boolean(
    result?.ok &&
      'phase' in result &&
      result.phase === 'completed' &&
      'type' in result &&
      result.type === 'EXPENSES_IMPORT_COMPLETED',
  );
}

function normalizeImportStatusUpdates(
  result: Extract<ExpensesImportResult, { phase: 'completed'; type: 'EXPENSES_IMPORT_COMPLETED' }>,
): Array<{ id: string; loaded: boolean; error?: string }> {
  if (Array.isArray(result.expenses) && result.expenses.length > 0) {
    return result.expenses
      .filter((expense) => typeof expense.id === 'string' && expense.id.length > 0)
      .map((expense) => ({
        id: expense.id,
        loaded: Boolean(expense.loaded),
        ...(expense.error ? { error: expense.error } : {}),
      }));
  }

  if (Array.isArray(result.loadedIds) && result.loadedIds.length > 0) {
    return result.loadedIds
      .filter((id) => typeof id === 'string' && id.length > 0)
      .map((id) => ({ id, loaded: true }));
  }

  return [];
}

function dispatchExpensesImport(payload: ExpensesImportPayload): Promise<ExpensesImportResult> {
  return new Promise((resolve) => {
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      document.removeEventListener(EXPENSES_IMPORT_RESULT_EVENT, handleResult);
      resolve({
        ok: false,
        error: 'No se recibió respuesta de la extensión Avvale Companion. Comprueba que está instalada y activa.',
      });
    }, 15_000);

    function handleResult(event: Event) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      document.removeEventListener(EXPENSES_IMPORT_RESULT_EVENT, handleResult);
      const detail = (event as CustomEvent<ExpensesImportResult>).detail;
      resolve(detail?.ok ? detail : { ok: false, error: detail?.error || 'Respuesta inválida de la extensión.' });
    }

    document.addEventListener(EXPENSES_IMPORT_RESULT_EVENT, handleResult);
    document.dispatchEvent(
      new CustomEvent(EXPENSES_IMPORT_START_EVENT, {
        bubbles: true,
        composed: true,
        detail: {
          payload,
        },
      }),
    );
  });
}

function AmountRangeSelector({
  min,
  max,
  step,
  value,
  onChange,
  lowInputId,
  highInputId,
}: {
  min: number;
  max: number;
  step: number;
  value: [number, number];
  onChange: (next: [number, number]) => void;
  lowInputId: string;
  highInputId: string;
}) {
  const [low, high] = value;
  const span = max - min;
  const lowPercent = span > 0 ? ((low - min) / span) * 100 : 0;
  const highPercent = span > 0 ? ((high - min) / span) * 100 : 100;

  const handleLowChange = (nextValue: number) => {
    const nextLow = clampRangeValue(nextValue, min, max, step);
    onChange([Math.min(nextLow, high), high]);
  };

  const handleHighChange = (nextValue: number) => {
    const nextHigh = clampRangeValue(nextValue, min, max, step);
    onChange([low, Math.max(nextHigh, low)]);
  };

  return (
    <div className={styles.rangeSlider}>
      <div className={styles.rangeTrackWrap}>
        <div className={styles.rangeTrackBg} aria-hidden="true" />
        <div
          className={styles.rangeTrackFill}
          style={{
            left: `calc(var(--range-thumb-radius) + (100% - var(--range-thumb-size)) * ${lowPercent / 100})`,
            width: `calc((100% - var(--range-thumb-size)) * ${Math.max(0, highPercent - lowPercent) / 100})`,
          }}
          aria-hidden="true"
        />
        <input
          id={lowInputId}
          type="range"
          className={`${styles.rangeInput} ${styles.rangeInputLow}`}
          min={min}
          max={max}
          step={step}
          value={low}
          onChange={(event) => handleLowChange(Number(event.target.value))}
          aria-label="Importe mínimo"
        />
        <input
          id={highInputId}
          type="range"
          className={`${styles.rangeInput} ${styles.rangeInputHigh}`}
          min={min}
          max={max}
          step={step}
          value={high}
          onChange={(event) => handleHighChange(Number(event.target.value))}
          aria-label="Importe máximo"
        />
      </div>
    </div>
  );
}

function SortIcon({ direction }: { direction: AmountSort }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      {direction === 'desc' ? (
        <path d="M12 5v14M18 13l-6 6-6-6" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M12 19V5M6 11l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}
