'use client';

import { offerCodeShortLabel } from '@/lib/offer-code-display';
import styles from './OfferCodeTableCell.module.css';

export interface OfferCodeTableCellProps {
  offerCode: string;
  /** Controlado desde el encabezado de la columna; expande el texto largo en todas las filas. */
  expanded: boolean;
}

export function OfferCodeTableCell({ offerCode, expanded }: OfferCodeTableCellProps) {
  const { short, fullTitle } = offerCodeShortLabel(offerCode);

  if (!fullTitle) {
    return <span className={styles.text}>{short}</span>;
  }

  return (
    <span className={expanded ? styles.textExpanded : styles.text}>
      {expanded ? fullTitle : short}
    </span>
  );
}
