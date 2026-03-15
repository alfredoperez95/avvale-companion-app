'use client';

import { useEffect, useState, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import type { Activation } from '@/types/activation';
import { KpiCard } from '@/components/KpiCard/KpiCard';
import { FilterBar } from '@/components/FilterBar/FilterBar';
import { DataTable, type Column } from '@/components/DataTable/DataTable';
import { DetailDrawer } from '@/components/DetailDrawer/DetailDrawer';
import { StatusTag } from '@/components/StatusTag/StatusTag';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  const [list, setList] = useState<Activation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchValue, setSearchValue] = useState('');
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

  const filtered = useMemo(() => {
    let data = list;
    if (statusFilter) data = data.filter((a) => a.status === statusFilter);
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
  }, [list, statusFilter, searchValue]);

  const kpis = useMemo(() => {
    const total = list.length;
    const draft = list.filter((a) => a.status === 'DRAFT').length;
    const sent = list.filter((a) => a.status === 'SENT').length;
    const error = list.filter((a) => a.status === 'ERROR').length;
    return { total, draft, sent, error };
  }, [list]);

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
