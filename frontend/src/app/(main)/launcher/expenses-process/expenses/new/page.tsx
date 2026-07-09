'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch, apiUpload, redirectToLogin } from '@/lib/api';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { PageBreadcrumb, PageBackLink, PageHero } from '@/components/page-hero';
import {
  ArrowUploadRegular,
  CameraRegular,
  DocumentRegular,
  ReceiptRegular,
  SparkleRegular,
  CheckmarkCircleRegular,
  CircleRegular,
} from '@fluentui/react-icons';
import styles from '../../expenses-process.module.css';
import { EXPENSE_CATEGORIES } from '../../expense-categories';
import { convertHeicToJpeg, isHeicFile } from '@/lib/heic';

const PROCESSING_STEPS = ['Guardando recibo', 'Analizando documento', 'Extrayendo datos'] as const;
const HEIC_CONVERT_STEP = 'Convirtiendo HEIC a JPG' as const;

type ProcessingPhase = 'idle' | 'converting' | 'scanning';

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

export default function NewExpensePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [expense, setExpense] = useState<Expense | null>(null);
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [paidByCompany, setPaidByCompany] = useState(false);
  const [descriptionDialogOpen, setDescriptionDialogOpen] = useState(false);
  const [processingPhase, setProcessingPhase] = useState<ProcessingPhase>('idle');
  const [processingStep, setProcessingStep] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanPreviewUrl, setScanPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processing = processingPhase !== 'idle';
  const scanning = processingPhase === 'scanning';
  const converting = processingPhase === 'converting';
  const activeScanPreviewUrl = scanPreviewUrl ?? previewUrl;
  const showUploadCard = !expense || processing || Boolean(expense.extractionError);

  useEffect(() => {
    if (!file || !isImageFile(file)) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    if (!scanning) {
      setProcessingStep(0);
      return;
    }
    setProcessingStep(0);
    const timers = [
      window.setTimeout(() => setProcessingStep(1), 1800),
      window.setTimeout(() => setProcessingStep(2), 4200),
    ];
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [scanning]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setExpense(null);
    setAmount('');
    setType('');
    setDescription('');
    setDate('');
    setPaidByCompany(false);
    setDescriptionDialogOpen(false);
    setError(null);
    event.target.value = '';
  };

  const clearSelectedFile = () => {
    setFile(null);
    setExpense(null);
    setAmount('');
    setType('');
    setDescription('');
    setDate('');
    setPaidByCompany(false);
    setDescriptionDialogOpen(false);
    setError(null);
  };

  const applyExpense = (next: Expense, options?: { askDescription?: boolean }) => {
    setExpense(next);
    setAmount(next.amount != null ? String(next.amount) : '');
    setType(next.type ?? '');
    setDescription(next.description ?? '');
    setDate(next.date ?? '');
    setPaidByCompany(next.paidByCompany ?? false);
    setError(next.extractionError ?? null);
    if (options?.askDescription) {
      setDescriptionDialogOpen(true);
    }
  };

  const processFile = async () => {
    if (!file) {
      setError('Selecciona o captura un recibo antes de procesarlo.');
      return;
    }
    setError(null);

    let uploadFile = file;
    let createdScanPreview: string | null = null;

    try {
      if (isHeicFile(file)) {
        setProcessingPhase('converting');
        try {
          uploadFile = await convertHeicToJpeg(file);
        } catch (err) {
          uploadFile = await convertHeicToJpegOnServer(file);
        }
        createdScanPreview = URL.createObjectURL(uploadFile);
        setScanPreviewUrl(createdScanPreview);
      }

      setProcessingPhase('scanning');

      const form = new FormData();
      form.append('file', uploadFile);
      const res = await apiUpload('/api/expenses/extract', form);
      if (res.status === 401) {
        redirectToLogin();
        return;
      }
      const data = await parseExpenseResponse(res);
      applyExpense(data, { askDescription: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar el recibo.');
    } finally {
      setProcessingPhase('idle');
      if (createdScanPreview) {
        URL.revokeObjectURL(createdScanPreview);
      }
      setScanPreviewUrl(null);
    }
  };

  const retryExtraction = async () => {
    if (!expense) return;
    setError(null);

    let createdScanPreview: string | null = null;

    try {
      if (expense.mimeType.startsWith('image/')) {
        const fileRes = await apiFetch(`/api${expense.fileUrl}`);
        if (fileRes.ok) {
          const blob = await fileRes.blob();
          createdScanPreview = URL.createObjectURL(blob);
          setScanPreviewUrl(createdScanPreview);
        }
      }

      setProcessingPhase('scanning');

      const res = await apiFetch(`/api/expenses/${expense.id}/retry-extract`, { method: 'POST' });
      if (res.status === 401) {
        redirectToLogin();
        return;
      }
      const data = await parseExpenseResponse(res);
      applyExpense(data, { askDescription: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reintentar la extracción.');
    } finally {
      setProcessingPhase('idle');
      if (createdScanPreview) {
        URL.revokeObjectURL(createdScanPreview);
      }
      setScanPreviewUrl(null);
    }
  };

  const saveExpense = async (event: FormEvent) => {
    event.preventDefault();
    if (!expense) {
      setError('Procesa y persiste el recibo antes de guardar.');
      return;
    }
    if (!amount || !type || !description.trim() || !date) {
      setError('Revisa los campos obligatorios: importe, tipo de gasto, descripción y fecha.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = { amount: Number(amount), type, description: description.trim(), date, paidByCompany };
      const res = await apiFetch(`/api/expenses/${expense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) {
        redirectToLogin();
        return;
      }
      if (!res.ok) throw new Error(await errorMessage(res));
      router.push('/launcher/expenses-process/expenses');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el gasto.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageIntro}>
        <PageBreadcrumb>
          <PageBackLink href="/launcher/expenses-process/expenses">← Gastos</PageBackLink>
        </PageBreadcrumb>
        <PageHero
          animateEnter={false}
          title="Nuevo gasto"
          subtitle="Sube un recibo desde cámara o archivo, deja que la IA proponga los datos y revísalos antes de guardar."
        />
      </div>

      <form className={styles.formStack} onSubmit={saveExpense}>
        {showUploadCard ? (
          <section className={`${styles.formSection} ${styles.uploadCard}`}>
            <header className={styles.uploadCardHeader}>
              <h2 className={styles.uploadCardTitle}>
                <ReceiptRegular fontSize={18} aria-hidden />
                Subir recibo
              </h2>
            </header>

            <div className={styles.uploadCardBody}>
              <p className={styles.uploadCardLead}>
                El archivo se guarda de forma persistente en Companion antes del análisis para poder reintentar la
                extracción y usarlo más adelante con la extensión Chrome.
              </p>

            {processing ? (
              <div
                className={styles.processingPanel}
                role="status"
                aria-live="polite"
                aria-busy="true"
                aria-label={
                  converting
                    ? 'Convirtiendo imagen HEIC a JPG'
                    : 'Procesando recibo con inteligencia artificial'
                }
              >
                <div
                  className={`${styles.processingPreviewWrap} ${converting ? styles.processingPreviewConverting : ''}`}
                >
                  {activeScanPreviewUrl && scanning ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={activeScanPreviewUrl} alt="" className={styles.processingPreviewImage} />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={activeScanPreviewUrl} alt="" className={styles.processingPreviewReveal} aria-hidden="true" />
                    </>
                  ) : (
                    <div className={styles.processingPreviewFallback}>
                      <DocumentRegular fontSize={40} aria-hidden />
                      <span>{file?.name ?? expense?.originalFileName ?? 'Recibo'}</span>
                    </div>
                  )}
                  {converting ? (
                    <div className={styles.processingConvertOverlay}>
                      <span className={styles.processingConvertSpinner} aria-hidden="true" />
                      <p className={styles.processingConvertTitle}>Convirtiendo HEIC a JPG</p>
                      <p className={styles.processingConvertHint}>
                        Preparando la imagen antes de iniciar el escaneo del recibo.
                      </p>
                    </div>
                  ) : null}
                  {scanning ? (
                    <>
                      <div className={styles.processingScanGrid} aria-hidden="true" />
                      <div className={styles.processingScanRuler} aria-hidden="true" />
                      <div className={styles.processingPreviewDim} aria-hidden="true" />
                      <div className={styles.processingScanFrame} aria-hidden="true">
                        <span />
                        <span />
                        <span />
                        <span />
                      </div>
                      <div className={styles.processingScannerHead} aria-hidden="true">
                        <div className={styles.processingScanCone} />
                        <span className={styles.processingScanLine} />
                      </div>
                      <div className={styles.processingScanHud} aria-hidden="true">
                        <span className={styles.processingScanStatus}>
                          <span className={styles.processingScanLed} />
                          Escaneando recibo
                          <span className={styles.processingLabelDots} aria-hidden="true" />
                        </span>
                      </div>
                      <div className={styles.processingProgressTrack} aria-hidden="true">
                        <span className={styles.processingProgressBar} />
                      </div>
                    </>
                  ) : null}
                </div>

                <ol className={styles.processingSteps}>
                  {converting ? (
                    <li className={`${styles.processingStep} ${styles.processingStepActive}`}>
                      <span className={styles.processingStepIcon} aria-hidden="true">
                        <CircleRegular fontSize={18} />
                      </span>
                      <span className={styles.processingStepLabel}>{HEIC_CONVERT_STEP}</span>
                      <span className={styles.processingStepPulse} aria-hidden="true" />
                    </li>
                  ) : (
                    PROCESSING_STEPS.map((step, index) => {
                      const done = index < processingStep;
                      const active = index === processingStep;
                      return (
                        <li
                          key={step}
                          className={`${styles.processingStep} ${done ? styles.processingStepDone : ''} ${active ? styles.processingStepActive : ''}`}
                        >
                          <span className={styles.processingStepIcon} aria-hidden="true">
                            {done ? <CheckmarkCircleRegular fontSize={18} /> : <CircleRegular fontSize={18} />}
                          </span>
                          <span className={styles.processingStepLabel}>{step}</span>
                          {active ? <span className={styles.processingStepPulse} aria-hidden="true" /> : null}
                        </li>
                      );
                    })
                  )}
                </ol>
              </div>
            ) : (
              <>
                <div className={styles.uploadGrid}>
                  <label className={styles.uploadOption}>
                    <span className={styles.uploadOptionIcon} aria-hidden="true">
                      <CameraRegular fontSize={24} />
                    </span>
                    <span className={styles.uploadOptionBody}>
                      <span className={styles.uploadTitle}>Hacer una foto</span>
                      <span className={styles.uploadHint}>Abre la cámara del móvil o navegador compatible.</span>
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/heic,.jpg,.jpeg,.png,.heic"
                      capture="environment"
                      onChange={handleFileChange}
                      disabled={processing || saving}
                    />
                  </label>

                  <div className={styles.uploadOr} aria-hidden="true">
                    <span>o</span>
                  </div>

                  <label className={styles.uploadOption}>
                    <span className={styles.uploadOptionIcon} aria-hidden="true">
                      <ArrowUploadRegular fontSize={24} />
                    </span>
                    <span className={styles.uploadOptionBody}>
                      <span className={styles.uploadTitle}>Seleccionar archivo</span>
                      <span className={styles.uploadHint}>JPG, JPEG, PNG, PDF o HEIC desde el dispositivo.</span>
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/heic,application/pdf,.jpg,.jpeg,.png,.pdf,.heic"
                      onChange={handleFileChange}
                      disabled={processing || saving}
                    />
                  </label>
                </div>

                {file ? (
                  <div className={styles.uploadFileChip}>
                    <span className={styles.uploadFileIcon} aria-hidden="true">
                      <DocumentRegular fontSize={20} />
                    </span>
                    <div className={styles.uploadFileMeta}>
                      <span className={styles.uploadFileName}>{file.name}</span>
                      {isHeicFile(file) ? (
                        <span className={styles.uploadFileNote}>Se guardará como JPG para previsualización.</span>
                      ) : (
                        <span className={styles.uploadFileNote}>Listo para procesar con IA.</span>
                      )}
                    </div>
                    <button
                      type="button"
                      className={styles.uploadFileClear}
                      onClick={clearSelectedFile}
                      disabled={processing || saving}
                    >
                      Quitar
                    </button>
                  </div>
                ) : null}
              </>
            )}
            </div>

            <footer className={styles.uploadCardFooter}>
              <div className={styles.uploadCardFooterActions}>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={() => void processFile()}
                  disabled={!file || processing || saving}
                >
                  {processing ? <span className={styles.btnSpinner} aria-hidden /> : <SparkleRegular fontSize={16} aria-hidden />}
                  {converting ? 'Convirtiendo…' : processing && !expense ? 'Procesando…' : 'Procesar con IA'}
                </button>
                {expense ? (
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => void retryExtraction()}
                    disabled={processing || saving}
                  >
                    {processing ? <span className={styles.btnSpinnerDark} aria-hidden /> : null}
                    {processing ? 'Reintentando…' : 'Reintentar extracción'}
                  </button>
                ) : null}
              </div>
            </footer>
          </section>
        ) : null}

        {error ? <div className={styles.error}>{error}</div> : null}

        {expense ? (
          <section className={`${styles.reviewCard} ${styles.uploadCard}`}>
            <header className={styles.uploadCardHeader}>
              <h2 className={styles.uploadCardTitle}>Revisar datos extraídos</h2>
            </header>
            <div className={styles.uploadCardBody}>
              <div className={styles.reviewGrid}>
                <label className={styles.formGroup}>
                  <span className={styles.label}>Importe</span>
                  <input
                    className={styles.input}
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={saving}
                    required
                  />
                </label>
                <label className={styles.formGroup}>
                  <span className={styles.label}>Tipo de gasto</span>
                  <select className={styles.select} value={type} onChange={(e) => setType(e.target.value)} disabled={saving} required>
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
                    onChange={(e) => setDate(e.target.value)}
                    disabled={saving}
                    required
                  />
                </label>
                <label className={styles.checkboxField}>
                  <input
                    type="checkbox"
                    checked={paidByCompany}
                    onChange={(e) => setPaidByCompany(e.target.checked)}
                    disabled={saving}
                  />
                  <span>Paid by company</span>
                </label>
                <label className={`${styles.formGroup} ${styles.formGroupFull}`}>
                  <span className={styles.label}>Descripción</span>
                  <textarea
                    className={styles.textarea}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ej. Taxi desde la oficina al aeropuerto para reunión con cliente."
                    rows={4}
                    maxLength={1000}
                    disabled={saving}
                    required
                  />
                </label>
              </div>
            </div>
          </section>
        ) : null}

        <footer className={styles.formFooter}>
          <p className={styles.formFooterHint}>
            No se enviará a ninguna plataforma externa en esta versión. Solo se guarda en Companion.
          </p>
          <div className={styles.formFooterActions}>
            <Link href="/launcher/expenses-process/expenses" className={styles.btnSecondary}>
              Cancelar
            </Link>
            <button type="submit" className={styles.btnPrimary} disabled={!expense || saving || processing}>
              {saving ? 'Guardando…' : 'Guardar gasto'}
            </button>
          </div>
        </footer>
      </form>

      <ConfirmDialog
        open={descriptionDialogOpen}
        title="Añadir descripción del gasto"
        confirmLabel="Guardar descripción"
        cancelLabel="Ahora no"
        onConfirm={() => setDescriptionDialogOpen(false)}
        onCancel={() => setDescriptionDialogOpen(false)}
        description={
          <div className={styles.dialogField}>
            <p className={styles.dialogText}>
              Indica a qué corresponde este gasto o añade algún detalle útil para revisarlo más adelante.
            </p>
            <label className={styles.formGroup}>
              <span className={styles.label}>Descripción</span>
              <textarea
                className={`${styles.textarea} ${styles.textareaCompact}`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej. Comida con cliente para revisión de propuesta."
                rows={3}
                maxLength={1000}
                autoFocus
              />
            </label>
          </div>
        }
      />
    </div>
  );
}

async function parseExpenseResponse(res: Response): Promise<Expense> {
  if (!res.ok) throw new Error(await errorMessage(res));
  return (await res.json()) as Expense;
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

async function convertHeicToJpegOnServer(file: File): Promise<File> {
  const form = new FormData();
  form.append('file', file);
  const res = await apiFetch('/api/expenses/convert-heic', {
    method: 'POST',
    body: form,
  });
  if (res.status === 401) {
    redirectToLogin();
    throw new Error('La sesión ha expirado.');
  }
  if (!res.ok) {
    throw new Error(await errorMessage(res));
  }
  const blob = await res.blob();
  const fileName = fileNameFromContentDisposition(res.headers.get('Content-Disposition')) ?? file.name.replace(/\.(heic|heif)$/i, '.jpg');
  return new File([blob], fileName || 'receipt.jpg', { type: 'image/jpeg' });
}

function fileNameFromContentDisposition(value: string | null): string | null {
  if (!value) return null;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(value)?.[1];
  if (encoded) return decodeURIComponent(encoded);
  return /filename="([^"]+)"/i.exec(value)?.[1] ?? null;
}

function isImageFile(file: File): boolean {
  const mime = file.type.toLowerCase();
  if (mime.startsWith('image/') && !mime.includes('heic') && !mime.includes('heif')) return true;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) || ext === 'heic' || ext === 'heif';
}
