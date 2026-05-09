'use client';

import { Suspense, type ReactNode } from 'react';
import { useUser } from '@/contexts/UserContext';
import KycWorkspace from '@/features/kyc/KycWorkspace';
import { KycRouteFallback } from './KycRouteFallback';
import styles from './kyc.module.css';

export default function KycLayout({ children }: { children: ReactNode }) {
  const user = useUser();
  if (!user) return null;
  return (
    <Suspense fallback={<KycRouteFallback />}>
      <KycWorkspace className={styles.frame} />
      {children}
    </Suspense>
  );
}
