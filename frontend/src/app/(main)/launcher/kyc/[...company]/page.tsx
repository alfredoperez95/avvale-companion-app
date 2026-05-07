'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import KycWorkspace from '@/features/kyc/KycWorkspace';
import styles from '../kyc.module.css';

function parseCompanyId(param: string | string[] | undefined): number | null {
  const first = Array.isArray(param) ? param[0] : param;
  if (!first) return null;
  const m = String(first).match(/^(\d+)(?:-|$)/);
  if (!m?.[1]) return null;
  const id = Number(m[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function parseCompanySlug(param: string | string[] | undefined): string | null {
  const first = Array.isArray(param) ? param[0] : param;
  if (!first) return null;
  if (/^\d+(?:-|$)/.test(String(first))) return null;
  return String(first).trim() || null;
}

export default function KycCompanyPage() {
  const user = useUser();
  const params = useParams<{ company?: string[] }>();
  if (!user) return null;
  const initialCompanyId = parseCompanyId(params?.company);
  const initialCompanySlug = parseCompanySlug(params?.company);
  return (
    <Suspense fallback={null}>
      <KycWorkspace
        className={styles.frame}
        initialCompanyId={initialCompanyId}
        initialCompanySlug={initialCompanySlug}
      />
    </Suspense>
  );
}

