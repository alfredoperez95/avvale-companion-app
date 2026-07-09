'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch, redirectToLogin } from '@/lib/api';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { PageBreadcrumb, PageBackLink, PageHero } from '@/components/page-hero';
import {
  EXPENSE_CATEGORIES,
  ExpenseCategoryLabel,
  expenseCategoryLabel,
} from '../../expense-categories';
import styles from '../../expenses-process.module.css';

type Expense = {
  id: string;
  amount: number | null;
  type: string | null;
  description: string | null;
  date: string | null;
  paidByCompany: boolean;
  fileUrl: string;
  originalFileName: string;
  mimeType: string;
  status: 'pending_review' | 'processed';
  extractionError?: string | null;
};

export default function ExpenseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const expenseId = params.id;

  const [expense, setExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [paidByCompany, setPaidByCompany] = useState(false);
  const previewUrlRef = useRef<string | null>(null);

  const hydrateForm = useCallback((next: Expense) => {
    setAmount(next.amount != null ? String(next.amount) : '');
    setType(next.type ?? '');
    setDescription(next.description ?? '');
    setDate(next.date ?? '');
    setPaidByCompany(next.paidByCompany ?? false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiFetch(`/api/expenses/${expenseId}`)
      .then(async (res) => {
        if (res.status === 401) {
          redirectToLogin();
          return null;
        }
        if (res.status === 404) throw new Error('Gasto no encontrado.');
        if (!res.ok) throw new Error('No se pudo cargar el gasto.');
        return (await res.json()) as Expense;
      })
      .then((data) => {
        if (!cancelled && data) {
          setExpense(data);
          hydrateForm(data);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo cargar el gasto.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [expenseId, hydrateForm]);

  useEffect(() => {
    if (!expense) return;
    if (!canPreviewInBrowser(expense.mimeType, expense.originalFileName)) return;

    let cancelled = false;
    setPreviewLoading(true);

    apiFetch(`/api${expense.fileUrl}`)
      .then(async (res) => {
        if (res.status === 401) {
          redirectToLogin();
          return null;
        }
        if (!res.ok) throw new Error('No se pudo cargar el recibo.');
        return res.blob();
      })
      .then((blob) => {
        if (!blob || cancelled) return;
        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setPreviewUrl(url);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar el recibo.');
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      setPreviewUrl(null);
    };
  }, [expense]);

  const openFile = async () => {
    if (!expense) return;
    try {
      const res = await apiFetch(`/api${expense.fileUrl}`);
      if (res.status === 401) {
        redirectToLogin();
        return;
      }
      if (!res.ok) throw new Error('No se pudo abrir el recibo.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir el recibo.');
    }
  };

  const startEdit = () => {
    if (!expense) return;
    hydrateForm(expense);
    setEditing(true);
    setError(null);
  };

  const cancelEdit = () => {
    if (!expense) return;
    hydrateForm(expense);
    setEditing(false);
    setError(null);
  };

  const saveExpense = async () => {
    if (!expense) return;
    if (!amount || !type || !description.trim() || !date) {
      setError('Revisa los campos obligatorios: importe, tipo de gasto, descripción y fecha.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/expenses/${expense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(amount),
          type,
          description: description.trim(),
          date,
          paidByCompany,
        }),
      });
      if (res.status === 401) {
        redirectToLogin();
        return;
      }
      if (!res.ok) throw new Error(await errorMessage(res));
      const updated = (await res.json()) as Expense;
      setExpense(updated);
      hydrateForm(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el gasto.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!expense) return;
    setDeleteBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/expenses/${expense.id}`, { method: 'DELETE' });
      if (res.status === 401) {
        redirectToLogin();
        return;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'No se pudo eliminar el gasto.');
      }
      router.push('/launcher/expenses-process/expenses');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el gasto.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const previewIsPdf = expense ? isPdf(expense.mimeType, expense.originalFileName) : false;

  return (
    <div className={styles.page}>
      <div className={styles.pageIntro}>
        <PageBreadcrumb>
          <PageBackLink href="/launcher/expenses-process/expenses">← Gastos</PageBackLink>
        </PageBreadcrumb>
        <PageHero
          animateEnter={false}
          title={expense?.description?.trim() || expenseCategoryLabel(expense?.type, '') || 'Detalle del gasto'}
          subtitle="Consulta el recibo adjunto y los datos registrados del gasto."
          actions={
            expense ? (
              <div className={styles.detailHeroActions}>
                <button type="button" className={styles.btnSecondary} onClick={startEdit}>
                  Editar datos
                </button>
                <button type="button" className={styles.btnSecondary} onClick={() => void openFile()}>
                  Abrir recibo
                </button>
                <button type="button" className={styles.btnDanger} onClick={() => setDeleteOpen(true)}>
                  Eliminar
                </button>
              </div>
            ) : null
          }
        />
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}
      {loading ? <div className={styles.stateCard}>Cargando gasto…</div> : null}

      {!loading && expense ? (
        <div className={styles.detailLayout}>
          <section className={styles.detailCard} aria-labelledby="expense-summary-title">
            <div className={styles.detailCardHeader}>
              <h2 id="expense-summary-title" className={styles.sectionTitle}>
                {editing ? 'Editar datos' : 'Resumen'}
              </h2>
              {!editing ? (
                <button type="button" className={styles.fileLink} onClick={startEdit}>
                  Editar
                </button>
              ) : null}
            </div>

            {editing ? (
              <div className={styles.detailEditForm}>
                <label className={styles.formGroup}>
                  <span className={styles.label}>Importe</span>
                  <input
                    className={styles.input}
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    disabled={saving}
                    required
                  />
                </label>
                <label className={styles.formGroup}>
                  <span className={styles.label}>Tipo de gasto</span>
                  <select
                    className={styles.select}
                    value={type}
                    onChange={(event) => setType(event.target.value)}
                    disabled={saving}
                    required
                  >
                    <option value="">Selecciona un tipo</option>
                    {EXPENSE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.formGroup}>
                  <span className={styles.label}>Fecha</span>
                  <input
                    className={styles.input}
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    disabled={saving}
                    required
                  />
                </label>
                <label className={styles.checkboxField}>
                  <input
                    type="checkbox"
                    checked={paidByCompany}
                    onChange={(event) => setPaidByCompany(event.target.checked)}
                    disabled={saving}
                  />
                  <span>Paid by company</span>
                </label>
                <label className={`${styles.formGroup} ${styles.detailEditFull}`}>
                  <span className={styles.label}>Descripción</span>
                  <textarea
                    className={styles.textarea}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Ej. Taxi desde la oficina al aeropuerto para reunión con cliente."
                    rows={4}
                    maxLength={1000}
                    disabled={saving}
                    required
                  />
                </label>
                <div className={`${styles.detailEditActions} ${styles.detailEditFull}`}>
                  <button type="button" className={styles.btnSecondary} onClick={cancelEdit} disabled={saving}>
                    Cancelar
                  </button>
                  <button type="button" className={styles.btnPrimary} onClick={() => void saveExpense()} disabled={saving}>
                    {saving ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </div>
              </div>
            ) : (
              <dl className={styles.detailGrid}>
                <div className={styles.detailItem}>
                  <dt>Fecha</dt>
                  <dd>{formatDate(expense.date)}</dd>
                </div>
                <div className={styles.detailItem}>
                  <dt>Paid by company</dt>
                  <dd>{expense.paidByCompany ? 'Sí' : 'No'}</dd>
                </div>
                <div className={styles.detailItem}>
                  <dt>Importe</dt>
                  <dd>{formatCurrency(expense.amount ?? 0)}</dd>
                </div>
                <div className={styles.detailItem}>
                  <dt>Tipo</dt>
                  <dd>
                    {expense.type ? (
                      <ExpenseCategoryLabel category={expense.type} />
                    ) : (
                      'Pendiente de revisar'
                    )}
                  </dd>
                </div>
                <div className={styles.detailItem}>
                  <dt>Estado</dt>
                  <dd>{expense.status === 'processed' ? 'Procesado' : 'Pendiente de revisar'}</dd>
                </div>
                {expense.description ? (
                  <div className={`${styles.detailItem} ${styles.detailItemFull}`}>
                    <dt>Descripción</dt>
                    <dd>{expense.description}</dd>
                  </div>
                ) : null}
                <div className={`${styles.detailItem} ${styles.detailItemFull}`}>
                  <dt>Recibo</dt>
                  <dd>
                    <button type="button" className={styles.fileLink} onClick={() => void openFile()}>
                      {expense.originalFileName}
                    </button>
                  </dd>
                </div>
              </dl>
            )}
          </section>

          <section className={styles.detailCard} aria-labelledby="expense-receipt-title">
            <div className={styles.detailCardHeader}>
              <h2 id="expense-receipt-title" className={styles.sectionTitle}>
                Recibo
              </h2>
              <button type="button" className={styles.fileLink} onClick={() => void openFile()}>
                Abrir en nueva pestaña
              </button>
            </div>

            {previewLoading ? <div className={styles.receiptPlaceholder}>Cargando recibo…</div> : null}

            {!previewLoading && previewUrl && !previewIsPdf ? (
              <img src={previewUrl} alt={`Recibo: ${expense.originalFileName}`} className={styles.receiptImage} />
            ) : null}

            {!previewLoading && previewUrl && previewIsPdf ? (
              <iframe
                title={`Recibo: ${expense.originalFileName}`}
                src={previewUrl}
                className={styles.receiptFrame}
              />
            ) : null}

            {!previewLoading && !previewUrl ? (
              <div className={styles.receiptPlaceholder}>
                <p>Este formato no se puede previsualizar aquí.</p>
                <button type="button" className={styles.btnSecondary} onClick={() => void openFile()}>
                  Abrir recibo
                </button>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      <ConfirmDialog
        open={deleteOpen}
        title="Eliminar gasto"
        message={
          expense
            ? `¿Eliminar el gasto del ${formatDate(expense.date)} (${formatCurrency(expense.amount ?? 0)})? Se borrará también el recibo adjunto. Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar"
        variant="danger"
        confirmBusy={deleteBusy}
        busyLabel="Eliminando…"
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          if (!deleteBusy) setDeleteOpen(false);
        }}
      />
    </div>
  );
}

function canPreviewInBrowser(mimeType: string, fileName: string): boolean {
  return isImage(mimeType, fileName) || isPdf(mimeType, fileName);
}

function isImage(mimeType: string, fileName: string): boolean {
  const mime = mimeType.toLowerCase();
  if (mime.startsWith('image/') && !mime.includes('heic') && !mime.includes('heif')) return true;
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
}

function isPdf(mimeType: string, fileName: string): boolean {
  const mime = mimeType.toLowerCase();
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return mime.includes('pdf') || ext === 'pdf';
}

function parseExpenseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(value: string | null | undefined): string {
  const date = parseExpenseDate(value ?? null);
  if (!date) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(data.message)) return data.message.join('\n');
    if (data.message) return data.message;
  } catch {
    // ignore non-json error
  }
  return 'La operación no se pudo completar.';
}
