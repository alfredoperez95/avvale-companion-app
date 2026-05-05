'use client';

import { useUser } from '@/contexts/UserContext';
import KycWorkspace from '@/features/kyc/KycWorkspace';
import styles from './kyc.module.css';

/**
 * KYC (Client Knowledge): UI React nativa, API Nest/Prisma en /api/kyc, solo ADMIN.
 */
export default function KycPage() {
  const user = useUser();

  if (user && user.role !== 'ADMIN') {
    return (
      <div className={styles.forbidden}>
        <h1>Acceso restringido</h1>
        <p>Solo los administradores pueden abrir el módulo KYC.</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <KycWorkspace className={styles.frame} />;
}
