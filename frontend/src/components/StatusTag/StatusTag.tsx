'use client';

import styles from './StatusTag.module.css';

const statusMap: Record<string, { label: string; style: string }> = {
  DRAFT: { label: 'Borrador', style: styles.draft },
  QUEUED: { label: 'En cola', style: styles.queued },
  PROCESSING: { label: 'Procesando', style: styles.processing },
  RETRYING: { label: 'Reintentando', style: styles.retrying },
  PENDING_CALLBACK: { label: 'Esperando Make', style: styles.pendingCallback },
  SENT: { label: 'Enviado', style: styles.sent },
  FAILED: { label: 'Error', style: styles.failed },
};

interface StatusTagProps {
  status: string;
}

export function StatusTag({ status }: StatusTagProps) {
  const config = statusMap[status] ?? { label: status, style: styles.draft };
  return (
    <span className={`${styles.tag} ${config.style}`} role="status">
      {(status === 'PENDING_CALLBACK' ||
        status === 'QUEUED' ||
        status === 'PROCESSING' ||
        status === 'RETRYING') && <span className={styles.spinner} aria-hidden="true" />}
      {config.label}
    </span>
  );
}
