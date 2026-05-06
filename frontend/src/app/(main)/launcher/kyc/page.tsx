'use client';

import { Suspense } from 'react';
import { useUser } from '@/contexts/UserContext';
import KycWorkspace from '@/features/kyc/KycWorkspace';
import styles from './kyc.module.css';

/**
 * KYC (Client Knowledge): UI React nativa, API Nest/Prisma en /api/kyc (usuario autenticado).
 */
export default function KycPage() {
  const user = useUser();

  if (!user) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <KycWorkspace className={styles.frame} />
    </Suspense>
  );
}
