'use client';

import { useEffect, useState, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import type { Activation } from '@/types/activation';
import { FilterBar } from '@/components/FilterBar/FilterBar';
import { DataTable, type Column } from '@/components/DataTable/DataTable';
import { DetailDrawer } from '@/components/DetailDrawer/DetailDrawer';
import { StatusTag } from '@/components/StatusTag/StatusTag';
import styles from './activations.module.css';

export default function ActivationsPage() {
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
          a.recipientTo.toLowerCase().includes(q) ||
          (a.recipientCc && a.recipientCc.toLowerCase().includes(q))
      );
    }
    return data;
  }, [list, statusFilter, searchValue]);

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
    { key: 'offerCode', header: 'Oferta', render: (row) => row.offerCode },
    { key: 'recipientTo', header: 'Destinatario', render: (row) => row.recipientTo },
    { key: 'status', header: 'Estado', render: (row) => <StatusTag status={row.status} /> },
    {
      key: 'createdAt',
      header: 'Creado',
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
          <h1 className={styles.pageTitle}>Mis activaciones</h1>
        </header>
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
            emptyMessage="No hay activaciones. Crea una desde Inicio o Nueva activación."
            getRowId={(row) => row.id}
            onRowClick={(row) => setSelectedId(row.id)}
          />
        </section>
      </div>
      <DetailDrawer
        activationId={selectedId}
        onClose={() => setSelectedId(null)}
        onUpdated={handleDrawerUpdated}
      />
    </>
  );
}
