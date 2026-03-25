'use client';

import styles from './OfferCodeTableCell.module.css';

export interface OfferCodeColumnHeaderProps {
  expanded: boolean;
  onToggle: () => void;
  /** Si es false, no hay códigos con descripción larga: se oculta el control. */
  showToggle: boolean;
}

export function OfferCodeColumnHeader({ expanded, onToggle, showToggle }: OfferCodeColumnHeaderProps) {
  if (!showToggle) {
    return <span className={styles.headerLabel}>Oferta</span>;
  }

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onToggle();
  };

  return (
    <span className={styles.headerRoot}>
      <span className={styles.headerLabel}>Oferta</span>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={expanded}
        title={
          expanded
            ? 'Ocultar detalle del código de oferta en todas las filas'
            : 'Mostrar código de oferta completo en todas las filas'
        }
        aria-label={
          expanded
            ? 'Ocultar detalle del código de oferta en todas las filas'
            : 'Mostrar código de oferta completo en todas las filas'
        }
        onClick={handleClick}
      >
        <span className={styles.toggleLabel}>
          ({expanded ? 'menos' : 'más'})
        </span>
      </button>
    </span>
  );
}
