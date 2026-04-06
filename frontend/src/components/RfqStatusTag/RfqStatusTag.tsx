'use client';

import styles from './RfqStatusTag.module.css';

const map: Record<string, { label: string; style: string; busy?: boolean }> = {
  DRAFT: { label: 'Borrador', style: styles.draft },
  QUEUED: { label: 'En cola', style: styles.queued, busy: true },
  PROCESSING: { label: 'Procesando', style: styles.processing, busy: true },
  COMPLETED: { label: 'Completado', style: styles.completed },
  FAILED: { label: 'Error', style: styles.failed },
  REJECTED: { label: 'Rechazado', style: styles.rejected },
};

interface RfqStatusTagProps {
  status: string;
}

export function RfqStatusTag({ status }: RfqStatusTagProps) {
  const config = map[status] ?? { label: status, style: styles.draft };
  return (
    <span className={`${styles.tag} ${config.style}`} role="status">
      {config.busy && <span className={styles.spinner} aria-hidden="true" />}
      {config.label}
    </span>
  );
}
