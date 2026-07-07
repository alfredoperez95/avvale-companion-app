'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { isDialogEnterTargetInteractive } from '@/lib/dialog-keyboard';
import {
  isScopedDialogPortalHost,
  lockDialogScroll,
  resolveDialogPortalHost,
  syncDialogOverlayBounds,
} from '@/lib/dialog-portal';
import styles from './ConfirmDialog.module.css';

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  /** Clase extra en el overlay (p. ej. z-index alto sobre widgets embebidos). */
  overlayClassName?: string;
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
  overlayClassName,
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
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalHost(resolveDialogPortalHost());
  }, []);

  const scopedOverlay = isScopedDialogPortalHost(portalHost);

  const resolvedConfirmVariant: 'primary' | 'danger' =
    confirmVariant ?? (variant === 'danger' ? 'danger' : 'primary');

  const bodyContent = description ?? message;
  const showBody =
    bodyContent != null &&
    bodyContent !== '' &&
    !(typeof bodyContent === 'string' && bodyContent.trim() === '');

  useEffect(() => {
    if (!open || !portalHost) return;
    const unlockScroll = lockDialogScroll(portalHost);
    const unsyncBounds = scopedOverlay ? syncDialogOverlayBounds(portalHost) : () => {};
    return () => {
      unlockScroll();
      unsyncBounds();
    };
  }, [open, portalHost, scopedOverlay]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmBusy) {
        onCancel();
        return;
      }
      if (e.key === 'Enter' && !confirmBusy) {
        if (isDialogEnterTargetInteractive(e.target)) return;
        e.preventDefault();
        onConfirm();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel, onConfirm, confirmBusy]);

  if (!open || !portalHost) return null;

  const handleOverlayClick = () => {
    if (!confirmBusy) onCancel();
  };

  const dialog = (
    <div
      className={[
        styles.overlay,
        scopedOverlay ? styles.overlayScoped : null,
        overlayClassName,
      ]
        .filter(Boolean)
        .join(' ')}
      role="presentation"
      onClick={handleOverlayClick}
    >
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

  return createPortal(dialog, portalHost);
}
