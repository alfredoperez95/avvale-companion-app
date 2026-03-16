'use client';

import { useEffect, useState, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import type { Activation } from '@/types/activation';
import { KpiCard } from '@/components/KpiCard/KpiCard';
import { FilterBar, type SolicitanteOption } from '@/components/FilterBar/FilterBar';
import { DataTable, type Column } from '@/components/DataTable/DataTable';
import { DetailDrawer } from '@/components/DetailDrawer/DetailDrawer';
import { StatusTag } from '@/components/StatusTag/StatusTag';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  const [list, setList] = useState<Activation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [solicitanteFilter, setSolicitanteFilter] = useState('');
  const [solicitanteOptions, setSolicitanteOptions] = useState<SolicitanteOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
            .catch(() => setSolicitanteOptions([]));
        }
      })
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    let data = list;
    if (statusFilter) data = data.filter((a) => a.status === statusFilter);
    if (solicitanteFilter) {
      data = data.filter((a) => a.createdByUserId === solicitanteFilter);
    }
    if (searchValue.trim()) {
      const q = searchValue.trim().toLowerCase();
      data = data.filter(
        (a) =>
          a.projectName.toLowerCase().includes(q) ||
          (a.client && a.client.toLowerCase().includes(q)) ||
          a.recipientTo.toLowerCase().includes(q) ||
          (a.recipientCc && a.recipientCc.toLowerCase().includes(q))
      );
    }
    return data;
  }, [list, statusFilter, solicitanteFilter, searchValue]);

  const kpis = useMemo(() => {
    const total = list.length;
    const draft = list.filter((a) => a.status === 'DRAFT').length;
    const sent = list.filter((a) => a.status === 'SENT').length;
    const error = list.filter((a) => a.status === 'ERROR').length;
    return { total, draft, sent, error };
  }, [list]);

  function getRequesterName(row: Activation): string {
    const u = row.createdByUser;
    if (u) {
      const full = [u.name, u.lastName].filter(Boolean).join(' ').trim();
      if (full) return full;
      return u.email ?? row.createdBy ?? '—';
    }
    return row.createdBy ?? '—';
  }

  const columns: Column<Activation>[] = [
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
    { key: 'offerCode', header: 'Oferta', render: (row) => row.offerCode },
    { key: 'createdByUser', header: 'Solicitante', render: (row) => getRequesterName(row) },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => <StatusTag status={row.status} />,
    },
    {
      key: 'createdAt',
      header: 'Fecha',
      render: (row) => new Date(row.createdAt).toLocaleDateString('es'),
    },
  ];

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
          <KpiCard title="Activaciones" value={kpis.total} icon="total" />
          <KpiCard title="Borradores" value={kpis.draft} icon="draft" />
          <KpiCard title="Enviadas" value={kpis.sent} icon="sent" />
          <KpiCard title="Errores" value={kpis.error} icon="error" />
        </section>

        <FilterBar
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          solicitanteFilter={solicitanteFilter}
          onSolicitanteFilterChange={setSolicitanteFilter}
          solicitanteOptions={solicitanteOptions}
        />

        <section className={styles.tableSection}>
          <DataTable<Activation>
            columns={columns}
            data={filtered}
            loading={loading}
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
