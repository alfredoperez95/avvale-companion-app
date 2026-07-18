'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { RfqStatusTag } from '@/components/RfqStatusTag/RfqStatusTag';
import styles from './kyc-workspace.module.css';

type RfqListItem = {
  id: string;
  title: string;
  status: string;
  sourceType: string;
  createdAt: string;
  updatedAt: string;
  originSubject: string | null;
  originEmail: string | null;
  kycCompanyId: number | null;
  kycCompany: { id: number; name: string } | null;
};

type Props = {
  companyId: number;
  companyName: string;
  onBanner: (msg: string | null) => void;
};

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function sourceLabel(sourceType: string): string {
  const s = (sourceType || '').toUpperCase();
  if (s === 'EMAIL') return 'Email';
  return 'Manual';
}

export function KycRfqsPanel({ companyId, companyName, onBanner }: Props) {
  const [items, setItems] = useState<RfqListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    onBanner(null);
    try {
      const res = await apiFetch(
        `/api/rfq-analyses?kycCompanyId=${encodeURIComponent(String(companyId))}&pageSize=50`,
      );
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'No se pudo cargar el listado de análisis RFQ');
      }
      const data = (await res.json()) as { items?: RfqListItem[] };
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error de red';
      setErr(msg);
      setItems([]);
      onBanner(msg);
    } finally {
      setLoading(false);
    }
  }, [companyId, onBanner]);

  useEffect(() => {
    void load();
  }, [load]);

  const newHref = `/launcher/rfq-analysis/new?kycCompanyId=${encodeURIComponent(String(companyId))}`;

  return (
    <div className={styles.profileStack}>
      <div className={styles.objectSection}>
        <div className={styles.objectSectionHead}>
          <div className={styles.objectSectionTitleGroup}>
            <h2 className={styles.objectSectionTitle}>Análisis RFQ</h2>
            <p className={styles.objectSectionSubtitle}>
              Workspaces de oportunidad del módulo «Análisis RFQs» vinculados a{' '}
              <strong>{companyName}</strong>. Abre un análisis para ver el insight, fuentes y chat; crea uno nuevo si
              aún no hay ninguno.
            </p>
          </div>
          <div className={styles.objectSectionActions}>
            <Link href={newHref} className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}>
              Nuevo análisis RFQ
            </Link>
          </div>
        </div>
        <div className={styles.objectSectionBody}>
          {loading ? (
            <div className={styles.kycRfqPanelLoading} aria-busy="true" aria-live="polite">
              <div className={styles.asideListLoaderSpinner} aria-hidden />
              <p className={styles.kycRfqPanelLoadingText}>Cargando análisis…</p>
            </div>
          ) : err ? (
            <p className={styles.objectSectionEmpty} role="alert">
              {err}
            </p>
          ) : items.length === 0 ? (
            <div className={styles.kycRfqEmpty}>
              <p className={`${styles.objectSectionEmpty} ${styles.objectSectionEmptyBottom}`}>
                No hay análisis RFQ asociados a esta empresa. Crea el primero para adjuntar documentación y generar el
                insight.
              </p>
              <Link href={newHref} className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}>
                Crear análisis RFQ
              </Link>
            </div>
          ) : (
            <ul className={styles.kycRfqList}>
              {items.map((it) => (
                <li key={it.id} className={styles.kycRfqRow}>
                  <div className={styles.kycRfqRowMain}>
                    <h3 className={styles.kycRfqRowTitle}>
                      <Link href={`/launcher/rfq-analysis/${it.id}`}>{it.title}</Link>
                    </h3>
                    <p className={styles.kycRfqRowMeta}>
                      Actualizado {formatWhen(it.updatedAt)} · Origen {sourceLabel(it.sourceType)}
                      {it.originSubject ? ` · ${it.originSubject}` : ''}
                    </p>
                  </div>
                  <div className={styles.kycRfqRowRight}>
                    <RfqStatusTag status={it.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
