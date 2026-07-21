'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, redirectToLogin } from '@/lib/api';
import { PageBreadcrumb, PageBackLink, PageHero, ChevronBackIcon } from '@/components/page-hero';
import styles from '../admin.module.css';

type KycAuditLogItem = {
  id: string;
  companyId: string | null;
  company: { id: string; name: string } | null;
  actorUserId: string | null;
  actor: { id: string; email: string; name?: string | null; lastName?: string | null } | null;
  action: string;
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  meta: unknown;
  createdAt: string;
};

type KycAuditLogResponse = {
  items: KycAuditLogItem[];
  total: number;
  page: number;
  pageSize: number;
};

function actorLabel(log: KycAuditLogItem): string {
  if (log.actor?.email) return log.actor.email;
  return log.actorUserId ?? 'Sistema / sin usuario';
}

function companyLabel(log: KycAuditLogItem): string {
  if (log.company?.name) return `${log.company.name} (#${log.company.id})`;
  return log.companyId ? `Empresa #${log.companyId}` : 'Empresa eliminada';
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'medium' });
}

function payloadSummary(value: unknown): string {
  if (value == null) return '—';
  if (Array.isArray(value)) return `Array (${value.length})`;
  if (typeof value === 'object') return `Objeto (${Object.keys(value as Record<string, unknown>).length} claves)`;
  return String(value).slice(0, 80);
}

export default function KycAuditAdminPage() {
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<KycAuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [companyId, setCompanyId] = useState('');
  const [actorUserId, setActorUserId] = useState('');
  const [action, setAction] = useState('');
  const [selected, setSelected] = useState<KycAuditLogItem | null>(null);

  const loadAudit = useCallback(
    async (nextPage = page) => {
      setError('');
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(pageSize),
      });
      if (companyId.trim()) params.set('companyId', companyId.trim());
      if (actorUserId.trim()) params.set('actorUserId', actorUserId.trim());
      if (action.trim()) params.set('action', action.trim());

      const res = await apiFetch(`/api/kyc/audit-logs?${params.toString()}`);
      if (res.status === 401) {
        redirectToLogin();
        return;
      }
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      const data = (await res.json().catch(() => null)) as KycAuditLogResponse | null;
      if (!res.ok || !data) {
        setError('No se pudo cargar el historial KYC.');
        return;
      }
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(Number(data.total ?? 0));
      setPage(Number(data.page ?? nextPage));
      setPageSize(Number(data.pageSize ?? pageSize));
    },
    [action, actorUserId, companyId, page, pageSize],
  );

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then((r) => {
        if (r.status === 401) {
          redirectToLogin();
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((user) => {
        if (user?.role !== 'ADMIN') {
          setForbidden(true);
          return;
        }
        return loadAudit(1);
      })
      .catch(() => setError('No se pudo verificar la sesión.'))
      .finally(() => setLoading(false));
  }, [loadAudit]);

  const maxPage = Math.max(1, Math.ceil(total / pageSize));

  if (loading) {
    return (
      <div className={styles.page}>
        <PageBreadcrumb>
          <PageBackLink href="/admin">
            <ChevronBackIcon />
            Administración
          </PageBackLink>
        </PageBreadcrumb>
        <div className={styles.loadingState} role="status" aria-live="polite">
          <span className={styles.loadingSpinner} aria-hidden />
          <span>Cargando auditoría KYC…</span>
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className={styles.page}>
        <PageBreadcrumb>
          <PageBackLink href="/admin">
            <ChevronBackIcon />
            Administración
          </PageBackLink>
        </PageBreadcrumb>
        <div className={styles.forbiddenCard} role="alert">
          <h1 className={styles.forbiddenTitle}>Acceso restringido</h1>
          <p className={styles.forbiddenText}>Solo los administradores pueden consultar la auditoría KYC.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <PageBreadcrumb>
        <PageBackLink href="/admin">
          <ChevronBackIcon />
          Administración
        </PageBackLink>
      </PageBreadcrumb>

      <PageHero
        title="Auditoría KYC"
        subtitle="Consulta eventos del catálogo KYC compartido: actor, acción, entidad y payload minimizado."
      />

      {error ? (
        <div className={styles.errorBanner} role="alert">
          {error}
        </div>
      ) : null}

      <section className={styles.card} aria-labelledby="kyc-audit-filters-heading">
        <h2 id="kyc-audit-filters-heading" className={styles.cardTitle}>
          Filtros
        </h2>
        <form
          className={styles.auditFilters}
          onSubmit={(event) => {
            event.preventDefault();
            void loadAudit(1);
          }}
        >
          <label>
            Empresa ID
            <input
              className={styles.input}
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              inputMode="numeric"
              placeholder="25"
            />
          </label>
          <label>
            Actor user ID
            <input
              className={styles.input}
              value={actorUserId}
              onChange={(e) => setActorUserId(e.target.value)}
              placeholder="uuid usuario"
            />
          </label>
          <label>
            Acción
            <input
              className={styles.input}
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="company.update"
            />
          </label>
          <label>
            Tamaño página
            <select className={styles.select} value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
          <div className={styles.auditFilterActions}>
            <button type="submit" className={styles.btnPrimary}>
              Buscar
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => {
                setCompanyId('');
                setActorUserId('');
                setAction('');
                setPageSize(50);
                setPage(1);
              }}
            >
              Limpiar
            </button>
          </div>
        </form>
      </section>

      <section className={styles.card} aria-labelledby="kyc-audit-results-heading">
        <div className={styles.usersCardHead}>
          <div className={styles.usersCardHeadText}>
            <h2 id="kyc-audit-results-heading" className={styles.cardTitle}>
              Eventos
            </h2>
            <p className={styles.cardDesc}>
              Mostrando página {page} de {maxPage}. Total: {total} eventos.
            </p>
          </div>
          <div className={styles.auditPager}>
            <button
              type="button"
              className={styles.btnSmall}
              disabled={page <= 1}
              onClick={() => void loadAudit(page - 1)}
            >
              Anterior
            </button>
            <button
              type="button"
              className={styles.btnSmall}
              disabled={page >= maxPage}
              onClick={() => void loadAudit(page + 1)}
            >
              Siguiente
            </button>
          </div>
        </div>

        <div className={styles.scrollWrap}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Acción</th>
                  <th scope="col">Entidad</th>
                  <th scope="col">Empresa</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Payload</th>
                  <th scope="col" className={styles.colActions}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={styles.empty}>
                      No hay eventos para los filtros actuales.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDateTime(item.createdAt)}</td>
                      <td className={styles.auditMono}>{item.action}</td>
                      <td>
                        <span className={styles.auditMono}>{item.entity}</span>
                        {item.entityId ? <span className={styles.auditSubtle}> #{item.entityId}</span> : null}
                      </td>
                      <td>{companyLabel(item)}</td>
                      <td>{actorLabel(item)}</td>
                      <td className={styles.auditSubtle}>
                        before: {payloadSummary(item.before)} · after: {payloadSummary(item.after)} · meta:{' '}
                        {payloadSummary(item.meta)}
                      </td>
                      <td className={styles.colActions}>
                        <button type="button" className={styles.btnSmall} onClick={() => setSelected(item)}>
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {selected ? (
        <section className={styles.card} aria-labelledby="kyc-audit-detail-heading">
          <div className={styles.usersCardHead}>
            <div className={styles.usersCardHeadText}>
              <h2 id="kyc-audit-detail-heading" className={styles.cardTitle}>
                Detalle evento {selected.id}
              </h2>
              <p className={styles.cardDesc}>
                Payload minimizado devuelto por backend. Los campos sensibles se redactan defensivamente.
              </p>
            </div>
            <button type="button" className={styles.btnSmall} onClick={() => setSelected(null)}>
              Cerrar
            </button>
          </div>
          <pre className={styles.auditJson}>
            {JSON.stringify(
              {
                before: selected.before,
                after: selected.after,
                meta: selected.meta,
              },
              null,
              2,
            )}
          </pre>
        </section>
      ) : null}
    </div>
  );
}
