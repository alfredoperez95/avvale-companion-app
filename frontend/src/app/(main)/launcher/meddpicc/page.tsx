'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { PageBreadcrumb, PageHero, PageBackLink, ChevronBackIcon } from '@/components/page-hero';
import { useUser } from '@/contexts/UserContext';
import { useSmoothLoading } from '@/hooks/useSmoothLoading';
import styles from './meddpicc.module.css';

type DealRow = {
  id: string;
  name: string;
  company: string;
  value: string;
  status: string;
  updatedAt: string;
  owner?: { email: string; name: string | null; lastName: string | null };
};

type Stats = {
  total: number;
  byUser: { userId: string; email: string; name: string | null; lastName: string | null; count: number }[];
};

type AdminUser = { id: string; email: string; name: string | null; lastName: string | null };

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function MeddpiccListPage() {
  const user = useUser();
  const isAdmin = user?.role === 'ADMIN';
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [filterUserId, setFilterUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const listLoadingVisible = useSmoothLoading(loading, { delayMs: 150, minVisibleMs: 250 });

  const query = useMemo(() => {
    const q = new URLSearchParams();
    if (isAdmin && filterUserId.trim()) q.set('userId', filterUserId.trim());
    const s = q.toString();
    return s ? `?${s}` : '';
  }, [isAdmin, filterUserId]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch('/api/users');
        if (!res.ok || cancelled) return;
        const rows = (await res.json()) as AdminUser[];
        if (!cancelled) setAdminUsers(rows);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [resDeals, resStats] = await Promise.all([
          apiFetch(`/api/meddpicc/deals${query}`),
          apiFetch('/api/meddpicc/deals/stats'),
        ]);
        if (!resDeals.ok) {
          if (!cancelled) setError('No se pudo cargar el listado');
          return;
        }
        const data = (await resDeals.json()) as { deals: DealRow[] };
        const st = resStats.ok ? ((await resStats.json()) as Stats) : null;
        if (!cancelled) {
          setDeals(data.deals ?? []);
          setStats(st);
        }
      } catch {
        if (!cancelled) setError('Error de red');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <div className={styles.page}>
      <PageBreadcrumb>
        <PageBackLink href="/launcher">
          <ChevronBackIcon />
          App Launcher
        </PageBackLink>
      </PageBreadcrumb>
      <PageHero
        title="MEDDPICC"
        subtitle="Cualificación de oportunidades mediante la metodología MEDDPICC, que valida las ocho dimensiones clave del proceso de venta (ROI, decisor, proceso, dolor, etc.), combinada con análisis con IA usando la clave Anthropic de tu perfil para priorizar y acelerar el cierre de deals."
        actions={
          <Link href="/launcher/meddpicc/new" className={styles.primaryBtn}>
            Nuevo deal
          </Link>
        }
      />

      {!loading && (isAdmin || stats) ? (
        <div className={styles.filtersCard}>
          <div className={styles.listHeroToolbar}>
            <div className={styles.listHeroToolbarStart}>
              {stats ? (
                <>
                  <div className={styles.listStatHighlight}>
                    <div className={styles.statValue}>{stats.total}</div>
                    <div className={styles.statLabel}>Deals activos (ámbito actual)</div>
                  </div>
                </>
              ) : isAdmin ? (
                <p className={styles.listStatsMuted}>Estadísticas no disponibles</p>
              ) : null}
            </div>
            {isAdmin ? (
              <div className={styles.listHeroToolbarEnd}>
                <div className={styles.filterBarEmbedBar}>
                  <div className={styles.filterEmbedField}>
                    <label className={styles.filterEmbedLabel} htmlFor="meddpicc-filter-user">
                      Filtrar por usuario (admin)
                    </label>
                    <select
                      id="meddpicc-filter-user"
                      className={styles.filterEmbedSelect}
                      value={filterUserId}
                      onChange={(e) => setFilterUserId(e.target.value)}
                      aria-label="Filtrar por usuario"
                    >
                      <option value="">Todos los usuarios</option>
                      {adminUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.email}
                          {u.name || u.lastName ? ` (${[u.name, u.lastName].filter(Boolean).join(' ')})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {error && <p className={styles.inlineError}>{error}</p>}

      {listLoadingVisible && (
        <div className={styles.loadingSkeleton} aria-busy="true" aria-live="polite" aria-label="Cargando listado de deals">
          <span className="sr-only">Cargando…</span>
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.skeletonCard}>
              <div className={styles.skeletonLine} style={{ width: '72%' }} />
              <div className={styles.skeletonLine} style={{ width: '48%' }} />
              <div className={styles.skeletonLine} style={{ width: '56%' }} />
            </div>
          ))}
        </div>
      )}

      {!loading && !error && deals.length === 0 && (
        <section className={styles.emptyState} aria-label="Sin oportunidades">
          <div className={styles.emptyStateIcon} aria-hidden />
          <h2 className={styles.emptyStateTitle}>Aún no hay oportunidades</h2>
          <p className={styles.emptyStateText}>
            Crea tu primer deal para empezar a cualificar con MEDDPICC y el análisis con IA.
          </p>
          <Link href="/launcher/meddpicc/new" className={`${styles.primaryBtn} ${styles.emptyStateCta}`}>
            Crear primer deal
          </Link>
        </section>
      )}

      {!loading && deals.length > 0 && (
        <>
          <div className={styles.resultsToolbar}>
            <p className={styles.resultsTitle}>
              {deals.length === 1 ? '1 oportunidad' : `${deals.length} oportunidades`}
            </p>
            <p className={styles.resultsMeta}>Pulsa una tarjeta para abrir la ficha.</p>
          </div>
        <div className={styles.dealGrid}>
          {deals.map((d) => (
            <Link key={d.id} href={`/launcher/meddpicc/${d.id}`} className={styles.dealCard}>
              <h2 className={styles.dealCardTitle}>{d.name}</h2>
              <p className={styles.dealCardMeta}>
                {d.company || 'Sin empresa'}
                {d.value ? ` · ${d.value}` : ''}
              </p>
              {isAdmin && d.owner && (
                <p className={styles.dealCardMeta}>
                  <span className={styles.badge}>{d.owner.email}</span>
                </p>
              )}
              <p className={styles.dealCardMeta}>Actualizado: {formatDate(d.updatedAt)}</p>
            </Link>
          ))}
        </div>
        </>
      )}
    </div>
  );
}
