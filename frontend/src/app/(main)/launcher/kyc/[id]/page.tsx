'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import KycWorkspace from '@/features/kyc/KycWorkspace';
import styles from '../kyc.module.css';

export default function KycCompanyPage() {
  const user = useUser();
  if (!user) return null;
  const params = useParams<{ id: string }>();
  const raw = String(params?.id ?? '');
  const id = Number(raw.split('-')[0]);
  const initialCompanyId = Number.isFinite(id) && id > 0 ? id : null;
  return (
    <Suspense fallback={null}>
      <KycWorkspace className={styles.frame} initialCompanyId={initialCompanyId} />
    </Suspense>
  );
}

