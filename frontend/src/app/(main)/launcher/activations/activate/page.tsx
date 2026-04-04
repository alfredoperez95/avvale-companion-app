'use client';

import Link from 'next/link';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import type { Activation } from '@/types/activation';
import { ACTIVATION_IN_FLIGHT_STATUSES } from '@/types/activation';
import { FilterBar, type SolicitanteOption } from '@/components/FilterBar/FilterBar';
import { DataTable, type Column } from '@/components/DataTable/DataTable';
import { DetailDrawer } from '@/components/DetailDrawer/DetailDrawer';
import { StatusTag } from '@/components/StatusTag/StatusTag';
import { useSmoothLoading } from '@/hooks/useSmoothLoading';
import { formatActivationCode } from '@/lib/activation-code';
import { offerCodeShortLabel } from '@/lib/offer-code-display';
import { OfferCodeColumnHeader } from '@/components/OfferCodeTableCell/OfferCodeColumnHeader';
import { OfferCodeTableCell } from '@/components/OfferCodeTableCell/OfferCodeTableCell';
import { PageBreadcrumb, PageBackLink, PageHero } from '@/components/page-hero';
import styles from './activations.module.css';

export default function ActivationsPage() {
  const [list, setList] = useState<Activation[]>([]);
  const [sendStartedMap, setSendStartedMap] = useState<Record<string, number>>({});
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
    const map: Record<string, number> = {};
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (!key?.startsWith('activation-send-started:')) continue;
        const activationId = key.replace('activation-send-started:', '');
        const ts = Number(sessionStorage.getItem(key));
        if (activationId && Number.isFinite(ts) && ts > 0) {
          map[activationId] = ts;
        }
      }
    } catch {}
    setSendStartedMap(map);
  }, []);

  const shouldSimulateSending = useCallback(
    (activation: Activation) => {
      const startedAt = sendStartedMap[activation.id];
      if (!startedAt) return false;
      if (activation.status !== 'DRAFT') return false;
      const elapsedMs = Date.now() - startedAt;
      // Evita que el primer render vuelva a mostrar `DRAFT` durante navegación inmediata.
      return elapsedMs < 10_000;
    },
    [sendStartedMap],
  );

  const fetchActivations = useCallback(async () => {
    const response = await apiFetch('/api/activations');
    if (response.status === 401) {
      window.location.href = '/login';
      return;
    }
    if (!response.ok) return;
    const data = await response.json();
    if (Array.isArray(data)) {
      setSendStartedMap((prev) => {
        const next = { ...prev };
        const now = Date.now();
        for (const activation of data as Activation[]) {
          const startedAt = next[activation.id];
          if (!startedAt) continue;
          const elapsedMs = now - startedAt;
          const isTerminal = activation.status === 'SENT' || activation.status === 'FAILED';
          const canClear =
            activation.status === 'FAILED' || (activation.status === 'SENT' && elapsedMs >= 5000);
          if (isTerminal && canClear) {
            delete next[activation.id];
            try {
              sessionStorage.removeItem(`activation-send-started:${activation.id}`);
            } catch {}
          }
        }
        return next;
      });
    }
    setList(Array.isArray(data) ? data : []);
  }, [sendStartedMap]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await apiFetch('/api/activations');
        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setList(Array.isArray(data) ? data : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const hasInFlight = list.some((a) => ACTIVATION_IN_FLIGHT_STATUSES.includes(a.status));
    const hasSimulatedSending = list.some((a) => shouldSimulateSending(a));
    if (!hasInFlight && !hasSimulatedSending) return;
    const intervalId = window.setInterval(() => {
      void fetchActivations().catch(() => {
        // Ignora errores puntuales de red; siguiente ciclo reintenta.
      });
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [list, fetchActivations, shouldSimulateSending]);

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
          a.offerCode.toLowerCase().includes(q) ||
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

  function getRequesterName(row: Activation): string {
    const u = row.createdByUser;
    if (u) {
      const full = [u.name, u.lastName].filter(Boolean).join(' ').trim();
      if (full) return full;
      return u.email ?? row.createdBy ?? '—';
    }
    return row.createdBy ?? '—';
  }

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
        minWidthPx: 120,
        render: (row) => (
          <StatusTag status={shouldSimulateSending(row) ? 'QUEUED' : row.status} />
        ),
      },
      {
        key: 'createdAt',
        header: 'Fecha',
        render: (row) => new Date(row.createdAt).toLocaleDateString('es'),
      },
    ];
  }, [offerCodesExpanded, offerColumnShowToggle, shouldSimulateSending]);

  const handleDrawerUpdated = (updated: Activation) => {
    setList((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  };

  return (
    <>
      <div className={styles.page}>
        <PageBreadcrumb>
          <PageBackLink href="/launcher/activations/dashboard">← Dashboard</PageBackLink>
        </PageBreadcrumb>
        <PageHero
          title="Mis activaciones"
          subtitle="Listado, filtros y seguimiento de tus solicitudes."
          actions={<Link href="/launcher/activations/activate/new" className={styles.btnNew}>Nueva activación</Link>}
        />
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
            emptyMessage="No hay activaciones. Crea una desde el Dashboard o Nueva activación."
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
