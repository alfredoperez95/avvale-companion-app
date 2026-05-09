'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { kycJson } from './kycApi';
import { KycIconBuilding } from './KycInlineIcons';
import {
  normalizeAvvalePayload,
  normProjectStatus,
  stableStringify,
  toApiBody,
  type KycAvvaleProject,
} from './kycAvvaleShared';
import styles from './kyc-workspace.module.css';

type Props = {
  companyId: number;
  profile: Record<string, unknown> | null;
  onRefetch: () => void;
  onBanner: (msg: string | null) => void;
};

function statusLabel(s: KycAvvaleProject['status']): string {
  if (s === 'past') return 'Pasado';
  if (s === 'negotiating') return 'En negociación';
  if (s === 'analyzing') return 'En análisis';
  return 'Activo';
}

export function KycAvvaleProjectsPanel({ companyId, profile, onRefetch, onBanner }: Props) {
  const [projects, setProjects] = useState<KycAvvaleProject[]>([]);
  const [baseline, setBaseline] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const loadFromProfile = useCallback(() => {
    const n = normalizeAvvalePayload(profile?.avvale);
    setProjects(n.projects.length ? n.projects : []);
    setBaseline(stableStringify(toApiBody(n)));
  }, [profile]);

  useEffect(() => {
    loadFromProfile();
  }, [loadFromProfile]);

  const currentBody = useMemo(() => {
    const base = normalizeAvvalePayload(profile?.avvale);
    return toApiBody({ ...base, projects });
  }, [profile, projects]);

  const dirty = stableStringify(currentBody) !== baseline;

  const enterEdit = () => setEditing(true);

  const exitToView = () => {
    if (dirty) {
      setDiscardOpen(true);
      return;
    }
    setEditing(false);
  };

  const confirmDiscard = () => {
    loadFromProfile();
    setEditing(false);
    setDiscardOpen(false);
  };

  const addProject = () => {
    if (!editing) setEditing(true);
    setProjects((prev) => [...prev, { id: crypto.randomUUID(), name: '', status: 'active' }]);
  };

  const removeProject = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const save = async () => {
    if (!dirty || saveBusy) return;
    setSaveBusy(true);
    onBanner(null);
    try {
      await kycJson(`/api/kyc/companies/${companyId}/profile`, {
        method: 'PATCH',
        headers: { 'X-Kyc-Avvale-Projects-Explicit': '1' },
        body: JSON.stringify({ avvale: currentBody }),
      });
      setBaseline(stableStringify(currentBody));
      onBanner('Proyectos guardados.');
      setEditing(false);
      onRefetch();
    } catch (e) {
      onBanner('No se pudieron guardar los proyectos en cuenta. ' + (e as Error).message);
    } finally {
      setSaveBusy(false);
    }
  };

  if (profile == null) {
    return (
      <p className={styles.objectSectionEmpty}>
        Activa el KYC de esta empresa para registrar proyectos de la cuenta (Avvale u otros partners), capturados a
        mano o desde el chat KYC.
      </p>
    );
  }

  return (
    <>
      <div className={styles.profileStack}>
        <div className={styles.objectSection}>
          <div className={styles.objectSectionHead}>
            <div className={styles.objectSectionTitleGroup}>
              <div className={styles.objectSectionTitleRow}>
                <span className={styles.objectSectionIcon} aria-hidden>
                  <KycIconBuilding />
                </span>
                <h2 className={styles.objectSectionTitle}>Proyectos</h2>
              </div>
              <p className={styles.objectSectionSubtitle}>
                Iniciativas recogidas en el KYC (manual o chat): pueden ser lideradas por Avvale o por otro partner.
                Estado activo, en análisis, en negociación o pasado; las notas ayudan a matizar quién participa. Las
                noticias por sí solas no bastan: usa la pestaña Señales para hipótesis desde RSS y regístralas aquí si
                las contrastas. Usa «Editar listado» para cambiar filas; los cambios se confirman con la barra inferior.
              </p>
            </div>
          </div>
        </div>

        <div className={styles.objectSection}>
          <div className={styles.objectSectionHead}>
            <div className={styles.objectSectionTitleGroup}>
              <h3 className={styles.objectSectionTitle}>Listado de proyectos en cliente</h3>
              <p className={styles.objectSectionSubtitle}>Nombre, estado y notas opcionales (p. ej. quién lidera).</p>
            </div>
            <div className={styles.objectSectionActions}>
              {editing ? (
                <>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                    onClick={() => exitToView()}
                  >
                    Ver listado
                  </button>
                  <button type="button" className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`} onClick={addProject}>
                    Añadir a proyectos en cuenta
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`} onClick={addProject}>
                    Añadir proyecto
                  </button>
                  <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} onClick={enterEdit}>
                    Editar listado
                  </button>
                </>
              )}
            </div>
          </div>
          <div className={styles.objectSectionBody}>
            {projects.length === 0 && !editing ? (
              <p className={styles.objectSectionEmpty}>
                Sin proyectos en esta ficha. Pulsa «Añadir proyecto» o «Editar listado» para crear filas.
              </p>
            ) : projects.length === 0 && editing ? (
              <p className={styles.objectSectionEmpty}>
                Aún no hay filas. Usa «Añadir a proyectos en cuenta» para añadir la primera.
              </p>
            ) : editing ? (
              <ul className={styles.avvaleProjectList}>
                {projects.map((p) => (
                  <li key={p.id} className={styles.avvaleProjectCard}>
                    <div className={styles.avvaleProjectTop}>
                      <input
                        className={styles.input}
                        value={p.name}
                        onChange={(e) =>
                          setProjects((prev) => prev.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))
                        }
                        placeholder="Nombre del proyecto en cuenta (Avvale u otro partner)"
                        aria-label={`Nombre del proyecto en cuenta ${p.id}`}
                      />
                      <select
                        className={styles.input}
                        value={p.status}
                        onChange={(e) =>
                          setProjects((prev) =>
                            prev.map((x) =>
                              x.id === p.id ? { ...x, status: normProjectStatus(e.target.value) } : x,
                            ),
                          )
                        }
                        aria-label={`Estado del proyecto en cuenta ${p.name || p.id}`}
                      >
                        <option value="active">Activo</option>
                        <option value="analyzing">En análisis</option>
                        <option value="negotiating">En negociación</option>
                        <option value="past">Pasado</option>
                      </select>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSm} ${styles.btnDangerOutline}`}
                        onClick={() => removeProject(p.id)}
                      >
                        Quitar
                      </button>
                    </div>
                    <textarea
                      className={styles.textareaLg}
                      rows={2}
                      value={p.notes ?? ''}
                      onChange={(e) =>
                        setProjects((prev) => prev.map((x) => (x.id === p.id ? { ...x, notes: e.target.value } : x)))
                      }
                      placeholder="Notas (opcional)"
                      aria-label={`Notas del proyecto en cuenta ${p.name || p.id}`}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <ul className={styles.avvaleProjectList}>
                {projects.map((p) => (
                  <li key={p.id} className={`${styles.avvaleProjectCard} ${styles.avvaleProjectCardReadonly}`}>
                    <div className={styles.avvaleProjectViewHead}>
                      <p className={styles.avvaleProjectViewName}>{p.name.trim() || 'Sin nombre'}</p>
                      <span
                        className={
                          p.status === 'past'
                            ? `${styles.avvaleProjectViewStatus} ${styles.avvaleProjectViewStatusPast}`
                            : p.status === 'negotiating'
                              ? `${styles.avvaleProjectViewStatus} ${styles.avvaleProjectViewStatusNegotiating}`
                              : p.status === 'analyzing'
                                ? `${styles.avvaleProjectViewStatus} ${styles.avvaleProjectViewStatusAnalyzing}`
                                : `${styles.avvaleProjectViewStatus} ${styles.avvaleProjectViewStatusActive}`
                        }
                      >
                        {statusLabel(p.status)}
                      </span>
                    </div>
                    {p.notes != null && String(p.notes).trim() ? (
                      <p className={styles.avvaleProjectViewNotes}>{String(p.notes).trim()}</p>
                    ) : (
                      <p className={styles.avvaleProjectViewEmptyNotes}>Sin notas.</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {editing && dirty ? (
          <div className={styles.saveBar}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}
              onClick={() => void save()}
              disabled={saveBusy}
            >
              {saveBusy ? 'Guardando…' : 'Guardar cambios'}
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
              onClick={() => setDiscardOpen(true)}
              disabled={saveBusy}
            >
              Descartar
            </button>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={discardOpen}
        title="¿Descartar cambios?"
        message="Se perderán las ediciones del listado de proyectos que aún no has guardado."
        confirmLabel="Descartar"
        cancelLabel="Cancelar"
        variant="danger"
        confirmVariant="danger"
        onCancel={() => setDiscardOpen(false)}
        onConfirm={() => confirmDiscard()}
      />
    </>
  );
}
