'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import type { Activation } from '@/types/activation';
import { KpiCard } from '@/components/KpiCard/KpiCard';
import { FilterBar, type SolicitanteOption } from '@/components/FilterBar/FilterBar';
import { DataTable, type Column } from '@/components/DataTable/DataTable';
import { DetailDrawer } from '@/components/DetailDrawer/DetailDrawer';
import { StatusTag } from '@/components/StatusTag/StatusTag';
import { useSmoothLoading } from '@/hooks/useSmoothLoading';
import { formatActivationCode } from '@/lib/activation-code';
import { offerCodeShortLabel } from '@/lib/offer-code-display';
import { OfferCodeColumnHeader } from '@/components/OfferCodeTableCell/OfferCodeColumnHeader';
import { OfferCodeTableCell } from '@/components/OfferCodeTableCell/OfferCodeTableCell';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  const [list, setList] = useState<Activation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [solicitanteFilter, setSolicitanteFilter] = useState('');
  const [solicitanteOptions, setSolicitanteOptions] = useState<SolicitanteOption[]>([]);
  const [solicitanteLoading, setSolicitanteLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [offerCodesExpanded, setOfferCodesExpanded] = useState(false);
  const tableLoading = useSmoothLoading(loading, { delayMs: 150, minVisibleMs: 250 });

  useEffect(() => {
    apiFetch('/api/activations')
      .then((r) => {
        if (r.status === 401) {
          window.location.href = '/login';
          return [];
        }
        return r.json();
      })
      .then(setList)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((user) => {
        if (user?.role === 'ADMIN') {
          apiFetch('/api/users')
            .then((r) => (r.ok ? r.json() : []))
            .then((users: { id: string; name?: string | null; lastName?: string | null; email: string }[]) => {
              setSolicitanteOptions(Array.isArray(users) ? users : []);
            })
            .catch(() => setSolicitanteOptions([]))
            .finally(() => setSolicitanteLoading(false));
        } else {
          setSolicitanteOptions([]);
          setSolicitanteLoading(false);
        }
      })
      .catch(() => {
        setSolicitanteOptions([]);
        setSolicitanteLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    let data = list;
    if (statusFilter) data = data.filter((a) => a.status === statusFilter);
    if (solicitanteFilter) {
      data = data.filter((a) => a.createdByUserId === solicitanteFilter);
    }
    if (searchValue.trim()) {
      const q = searchValue.trim().toLowerCase();
      const qNum = searchValue.trim().replace(/\D/g, '');
      data = data.filter((a) => {
        const code = formatActivationCode(a.activationNumber).toLowerCase();
        return (
          a.projectName.toLowerCase().includes(q) ||
          (a.client && a.client.toLowerCase().includes(q)) ||
          a.recipientTo.toLowerCase().includes(q) ||
          (a.recipientCc && a.recipientCc.toLowerCase().includes(q)) ||
          code.includes(q) ||
          String(a.activationNumber).includes(qNum)
        );
      });
    }
    return data;
  }, [list, statusFilter, solicitanteFilter, searchValue]);

  const offerColumnShowToggle = useMemo(
    () => filtered.some((a) => Boolean(offerCodeShortLabel(a.offerCode).fullTitle)),
    [filtered],
  );

  useEffect(() => {
    if (!offerColumnShowToggle) setOfferCodesExpanded(false);
  }, [offerColumnShowToggle]);

  const kpis = useMemo(() => {
    const total = list.length;
    const draft = list.filter((a) => a.status === 'DRAFT').length;
    const sent = list.filter((a) => a.status === 'SENT').length;
    const error = list.filter((a) => a.status === 'FAILED').length;
    return { total, draft, sent, error };
  }, [list]);

  const getRequesterName = useCallback((row: Activation): string => {
    const u = row.createdByUser;
    if (u) {
      const full = [u.name, u.lastName].filter(Boolean).join(' ').trim();
      if (full) return full;
      return u.email ?? row.createdBy ?? '—';
    }
    return row.createdBy ?? '—';
  }, []);

  const columns = useMemo((): Column<Activation>[] => {
    return [
      {
        key: 'activationNumber',
        header: 'Nº',
        render: (row) => (
          <span title={`${formatActivationCode(row.activationNumber)}`}>
            {formatActivationCode(row.activationNumber)}
          </span>
        ),
      },
      {
        key: 'projectName',
        header: 'Proyecto',
        render: (row) => (
          <button
            type="button"
            className={styles.tableLink}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedId(row.id);
            }}
          >
            {row.projectName}
          </button>
        ),
      },
      { key: 'client', header: 'Cliente', render: (row) => row.client ?? '—' },
      {
        key: 'offerCode',
        header: 'Oferta',
        renderHeader: () => (
          <OfferCodeColumnHeader
            expanded={offerCodesExpanded}
            onToggle={() => setOfferCodesExpanded((v) => !v)}
            showToggle={offerColumnShowToggle}
          />
        ),
        render: (row) => (
          <OfferCodeTableCell offerCode={row.offerCode} expanded={offerCodesExpanded} />
        ),
      },
      { key: 'createdByUser', header: 'Solicitante', render: (row) => getRequesterName(row) },
      {
        key: 'status',
        header: 'Estado',
        minWidthPx: 110,
        render: (row) => <StatusTag status={row.status} />,
      },
      {
        key: 'createdAt',
        header: 'Fecha',
        render: (row) => new Date(row.createdAt).toLocaleDateString('es'),
      },
    ];
  }, [getRequesterName, offerCodesExpanded, offerColumnShowToggle]);

  const handleDrawerUpdated = (updated: Activation) => {
    setList((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  };

  return (
    <>
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Dashboard</h1>
        </header>

        <section className={styles.kpiSection} aria-label="Resumen">
          <KpiCard title="Activaciones" value={kpis.total} icon="total" loading={loading} />
          <KpiCard title="Borradores" value={kpis.draft} icon="draft" loading={loading} />
          <KpiCard title="Enviadas" value={kpis.sent} icon="sent" loading={loading} />
          <KpiCard title="Errores" value={kpis.error} icon="error" loading={loading} />
        </section>

        <FilterBar
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          solicitanteFilter={solicitanteFilter}
          onSolicitanteFilterChange={setSolicitanteFilter}
          solicitanteOptions={solicitanteOptions}
          solicitanteLoading={solicitanteLoading}
        />

        <section className={styles.tableSection}>
          <DataTable<Activation>
            columns={columns}
            data={filtered}
            loading={tableLoading}
            emptyMessage="No hay activaciones que coincidan con los filtros."
            getRowId={(row) => row.id}
            onRowClick={(row) => setSelectedId(row.id)}
          />
        </section>
      </div>

      <DetailDrawer
        activationId={selectedId}
        onClose={() => setSelectedId(null)}
        onUpdated={handleDrawerUpdated}
        onDeleted={() => {
          if (selectedId) setList((prev) => prev.filter((a) => a.id !== selectedId));
          setSelectedId(null);
        }}
      />
    </>
  );
}
