'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { isDialogEnterTargetInteractive } from '@/lib/dialog-keyboard';
import styles from './InfoDialog.module.css';

export type InfoDialogProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Contenido a la izquierda del pie (p. ej. enlace a documentación). */
  footerStart?: ReactNode;
  closeLabel?: string;
};

/**
 * Modal informativo (Fiori): Escape y clic fuera cierran. Foco inicial en el botón Cerrar.
 * Para confirmaciones destructivas usar `ConfirmDialog`.
 */
export function InfoDialog({
  open,
  title,
  onClose,
  children,
  footerStart,
  closeLabel = 'Cerrar',
}: InfoDialogProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const hasFooterStart = footerStart != null && footerStart !== false;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Enter') {
        if (isDialogEnterTargetInteractive(e.target)) return;
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => {
      closeRef.current?.focus();
    }, 0);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={styles.dialog}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
        </header>
        <div className={styles.body}>{children}</div>
        <footer
          className={`${styles.footer} ${hasFooterStart ? styles.footerWithStart : ''}`}
        >
          {hasFooterStart ? <div className={styles.footerStart}>{footerStart}</div> : null}
          <button ref={closeRef} type="button" className={styles.btnClose} onClick={onClose}>
            {closeLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
