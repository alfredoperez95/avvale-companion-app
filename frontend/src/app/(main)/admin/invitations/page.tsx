'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch, redirectToLogin } from '@/lib/api';
import { PageBreadcrumb, PageBackLink, PageHero, ChevronBackIcon } from '@/components/page-hero';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { positionLabel } from '@/lib/user-position';
import styles from '../admin.module.css';

type InvitationRow = {
  id: string;
  email: string;
  name: string;
  lastName: string;
  position: string | null;
  industry: string | null;
  role: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  invitedBy: { id: string; email: string; name: string | null; lastName: string | null };
};

function inviteStatus(row: InvitationRow): 'pending' | 'expired' | 'used' {
  if (row.usedAt) return 'used';
  if (new Date(row.expiresAt).getTime() <= Date.now()) return 'expired';
  return 'pending';
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('es-ES', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function invitedByLabel(inv: InvitationRow['invitedBy']) {
  const n = [inv.name, inv.lastName].filter(Boolean).join(' ').trim();
  return n || inv.email;
}

export default function AdminInvitationsPage() {
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [rows, setRows] = useState<InvitationRow[]>([]);
  const [error, setError] = useState('');
  const [resendBusyId, setResendBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InvitationRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await apiFetch('/api/invitations');
    if (res.status === 401) {
      redirectToLogin();
      return;
    }
    if (!res.ok) {
      setError('No se pudo cargar el listado de invitaciones.');
      return;
    }
    const data = await res.json();
    setRows(Array.isArray(data) ? data : []);
    setError('');
  }, []);

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
          setLoading(false);
          return;
        }
        load().finally(() => setLoading(false));
      })
      .catch(() => setLoading(false));
  }, [load]);

  const handleResend = async (id: string) => {
    setError('');
    setResendBusyId(id);
    try {
      const res = await apiFetch(`/api/invitations/${id}/resend`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.message === 'string' ? data.message : 'No se pudo reenviar la invitación.',
        );
        return;
      }
      await load();
    } finally {
      setResendBusyId(null);
    }
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setError('');
    try {
      const res = await apiFetch(`/api/invitations/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.status === 204) {
        setDeleteTarget(null);
        await load();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(typeof data.message === 'string' ? data.message : 'No se pudo eliminar.');
    } finally {
      setDeleteBusy(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <PageBreadcrumb>
          <PageBackLink href="/admin">
            <ChevronBackIcon />
            Gestión de usuarios
          </PageBackLink>
        </PageBreadcrumb>
        <div className={styles.loadingState} role="status" aria-live="polite">
          <span className={styles.loadingSpinner} aria-hidden />
          <span>Cargando invitaciones…</span>
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className={styles.page}>
        <PageBreadcrumb>
          <PageBackLink href="/launcher/activations/dashboard">
            <ChevronBackIcon />
            Dashboard
          </PageBackLink>
        </PageBreadcrumb>
        <div className={styles.forbiddenCard} role="alert">
          <h1 className={styles.forbiddenTitle}>Acceso restringido</h1>
          <p className={styles.forbiddenText}>
            Solo los administradores pueden abrir esta sección.
          </p>
          <PageBackLink href="/launcher/activations/dashboard" className={styles.forbiddenLink}>
            <ChevronBackIcon />
            Ir al dashboard
          </PageBackLink>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <PageBreadcrumb>
        <PageBackLink href="/admin">
          <ChevronBackIcon />
          Gestión de usuarios
        </PageBackLink>
      </PageBreadcrumb>
      <PageHero
        title="Invitaciones enviadas"
        subtitle="Registros pendientes de completar, caducados o ya usados. Reenviar genera un enlace nuevo y deja la invitación vigente 24 horas."
      />
      {error ? (
        <div className={styles.errorBanner} role="alert">
          {error}
        </div>
      ) : null}

      <section className={styles.card} aria-labelledby="invitations-heading">
        <div className={styles.usersCardHead}>
          <div className={styles.usersCardHeadText}>
            <h2 id="invitations-heading" className={styles.cardTitle}>
              Invitaciones
            </h2>
            <p className={styles.cardDesc}>
              Pendiente: aún no se ha registrado. Caducada: el plazo expiró (puedes reenviar). Usada: registro completado.
            </p>
          </div>
          <span
            className={styles.userCountPill}
            title="Total de invitaciones"
            aria-label={`${rows.length} invitaciones en total`}
          >
            {rows.length}
          </span>
        </div>
        <div className={styles.scrollWrap}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Email</th>
                  <th scope="col">Persona</th>
                  <th scope="col">Puesto</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Caduca</th>
                  <th scope="col">Creada</th>
                  <th scope="col">Invitada por</th>
                  <th scope="col" className={styles.colActions}>
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className={styles.empty}>
                      No hay invitaciones registradas.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const st = inviteStatus(row);
                    return (
                      <tr key={row.id}>
                        <td className={styles.cellEmail}>{row.email}</td>
                        <td className={styles.cellName}>
                          {[row.name, row.lastName].filter(Boolean).join(' ') || '—'}
                        </td>
                        <td>{positionLabel(row.position)}</td>
                        <td>
                          {st === 'used' ? (
                            <span className={styles.badgeInviteUsed}>Usada</span>
                          ) : st === 'expired' ? (
                            <span className={styles.badgeInviteExpired}>Caducada</span>
                          ) : (
                            <span className={styles.badgeInvitePending}>Pendiente</span>
                          )}
                        </td>
                        <td>{formatDate(row.expiresAt)}</td>
                        <td>{formatDate(row.createdAt)}</td>
                        <td className={styles.cellIndustry}>{invitedByLabel(row.invitedBy)}</td>
                        <td className={styles.colActions}>
                          {st !== 'used' ? (
                            <button
                              type="button"
                              className={styles.btnSmall}
                              disabled={resendBusyId === row.id}
                              onClick={() => void handleResend(row.id)}
                            >
                              {resendBusyId === row.id ? 'Reenviando…' : 'Reenviar'}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className={styles.btnDanger}
                            disabled={deleteBusy}
                            onClick={() => setDeleteTarget(row)}
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        <p className={styles.cardDesc} style={{ marginTop: 'var(--fiori-space-3)', marginBottom: 0 }}>
          <strong>Reenviar:</strong> nuevo enlace por correo y vigencia de <strong>24 horas</strong> desde el envío.
          Solo disponible si la invitación sigue pendiente (no registrada).
        </p>
      </section>

      <ConfirmDialog
        open={deleteTarget != null}
        title="Eliminar invitación"
        message={
          deleteTarget
            ? `¿Eliminar la invitación para ${deleteTarget.email}? No podrá usarse el enlace anterior.`
            : ''
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        confirmBusy={deleteBusy}
        busyLabel="Eliminando…"
        onConfirm={() => void executeDelete()}
        onCancel={() => {
          if (!deleteBusy) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
