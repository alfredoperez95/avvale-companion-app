'use client';

import { useEffect, useId, type ReactNode } from 'react';
import styles from './ConfirmDialog.module.css';

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  /** Texto o contenido del cuerpo (uso habitual en la app). */
  message?: ReactNode;
  /** Contenido rico del cuerpo; si existe, tiene prioridad sobre `message`. */
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Tono del diálogo: título en rojo si `danger`. */
  variant?: 'default' | 'danger';
  /** Estilo del botón de confirmación (por defecto: rojo si `variant="danger"`, si no acento). */
  confirmVariant?: 'primary' | 'danger';
  confirmBusy?: boolean;
  /** Texto del botón principal mientras `confirmBusy`. */
  busyLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Diálogo modal de confirmación (estética Fiori). No usar `window.confirm` / `alert` para flujos de producto.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  confirmVariant,
  confirmBusy = false,
  busyLabel = 'Procesando…',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();

  const resolvedConfirmVariant: 'primary' | 'danger' =
    confirmVariant ?? (variant === 'danger' ? 'danger' : 'primary');

  const bodyContent = description ?? message;
  const showBody =
    bodyContent != null &&
    bodyContent !== '' &&
    !(typeof bodyContent === 'string' && bodyContent.trim() === '');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmBusy) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel, confirmBusy]);

  if (!open) return null;

  const handleOverlayClick = () => {
    if (!confirmBusy) onCancel();
  };

  return (
    <div className={styles.overlay} role="presentation" onClick={handleOverlayClick}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={styles.dialog}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2
            id={titleId}
            className={`${styles.title} ${variant === 'danger' ? styles.titleDanger : ''}`}
          >
            {title}
          </h2>
        </header>
        {showBody ? (
          <div className={styles.body}>
            <div className={styles.description}>{bodyContent}</div>
          </div>
        ) : null}
        <footer className={styles.actions}>
          <button
            type="button"
            className={styles.btnCancel}
            onClick={onCancel}
            disabled={confirmBusy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`${styles.btnConfirm} ${resolvedConfirmVariant === 'danger' ? styles.btnConfirmDanger : ''}`}
            onClick={() => onConfirm()}
            disabled={confirmBusy}
          >
            {confirmBusy ? busyLabel : confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
