'use client';

import styles from './StatusTag.module.css';

const statusMap: Record<string, { label: string; style: string }> = {
  DRAFT: { label: 'Borrador', style: styles.draft },
  READY_TO_SEND: { label: 'Envío iniciado', style: styles.readyToSend },
  SENT: { label: 'Enviado', style: styles.sent },
  ERROR: { label: 'Error', style: styles.error },
};

interface StatusTagProps {
  status: string;
}

export function StatusTag({ status }: StatusTagProps) {
  const config = statusMap[status] ?? { label: status, style: styles.draft };
  return (
    <span className={`${styles.tag} ${config.style}`} role="status">
      {status === 'READY_TO_SEND' && <span className={styles.spinner} aria-hidden="true" />}
      {config.label}
    </span>
  );
}
