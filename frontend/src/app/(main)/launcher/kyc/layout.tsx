'use client';

import type { ReactNode } from 'react';
import { useUser } from '@/contexts/UserContext';
import KycWorkspace from '@/features/kyc/KycWorkspace';
import { KycUrlParamsRoot } from '@/features/kyc/KycUrlParamsContext';
import styles from './kyc.module.css';

export default function KycLayout({ children }: { children: ReactNode }) {
  const user = useUser();
  if (!user) return null;
  return (
    <KycUrlParamsRoot>
      <KycWorkspace className={styles.frame} />
      {children}
    </KycUrlParamsRoot>
  );
}
