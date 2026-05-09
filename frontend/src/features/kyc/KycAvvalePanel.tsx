'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { kycJson } from './kycApi';
import { KycIconBuilding } from './KycInlineIcons';
import {
  KYC_SOLUTION_LINES,
  normalizeAvvalePayload,
  stableStringify,
  toApiBody,
  type KycSolutionSlug,
} from './kycAvvaleShared';
import styles from './kyc-workspace.module.css';

export type { KycAvvaleProject, KycAvvaleProjectStatus, KycSolutionSlug } from './kycAvvaleShared';
export { KYC_SOLUTION_LINES, KYC_SOLUTION_SLUGS } from './kycAvvaleShared';

type Props = {
  companyId: number;
  profile: Record<string, unknown> | null;
  onRefetch: () => void;
  onBanner: (msg: string | null) => void;
};

export function KycAvvalePanel({ companyId, profile, onRefetch, onBanner }: Props) {
  const [footprint, setFootprint] = useState('');
  const [presence, setPresence] = useState<KycSolutionSlug[]>([]);
  const [solutionNotes, setSolutionNotes] = useState<Partial<Record<KycSolutionSlug, string>>>({});
  const [baseline, setBaseline] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const loadFromProfile = useCallback(() => {
    const raw = profile?.avvale;
    const n = normalizeAvvalePayload(raw);
    setFootprint(n.footprint);
    setPresence(n.solution_presence);
    setSolutionNotes(n.solution_notes);
    setBaseline(stableStringify(toApiBody(n)));
  }, [profile]);

  useEffect(() => {
    loadFromProfile();
  }, [loadFromProfile]);

  const currentBody = useMemo(() => {
    const base = normalizeAvvalePayload(profile?.avvale);
    return toApiBody({
      ...base,
      footprint,
      solution_presence: presence,
      solution_notes: solutionNotes,
    });
  }, [profile, footprint, presence, solutionNotes]);

  const dirty = stableStringify(currentBody) !== baseline;

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

  const enterEdit = () => setEditing(true);

  const togglePresence = (slug: KycSolutionSlug) => {
    setPresence((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  };

  const save = async () => {
    if (!dirty || saveBusy) return;
    setSaveBusy(true);
    onBanner(null);
    try {
      await kycJson(`/api/kyc/companies/${companyId}/profile`, {
        method: 'PATCH',
        body: JSON.stringify({ avvale: currentBody }),
      });
      setBaseline(stableStringify(currentBody));
      onBanner('Presencia Avvale guardada.');
      setEditing(false);
      onRefetch();
    } catch (e) {
      onBanner('No se pudo guardar la presencia Avvale. ' + (e as Error).message);
    } finally {
      setSaveBusy(false);
    }
  };

  if (profile == null) {
    return (
      <p className={styles.objectSectionEmpty}>
        Activa el KYC de esta empresa para editar footprint y presencia por línea de solución.
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
                <h2 className={styles.objectSectionTitle}>Presencia de Avvale en la cuenta</h2>
              </div>
              <p className={styles.objectSectionSubtitle}>
                Footprint y líneas de solución. La lista de proyectos de la cuenta (Avvale u otros partners, manual o
                chat) está en la pestaña «Proyectos». Pulsa «Editar» para cambiar datos; los cambios se confirman con la
                barra inferior.
              </p>
            </div>
            <div className={styles.objectSectionActions}>
              {editing ? (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                  onClick={() => exitToView()}
                >
                  Ver
                </button>
              ) : (
                <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} onClick={enterEdit}>
                  Editar
                </button>
              )}
            </div>
          </div>
        </div>

        <div className={styles.objectSection}>
          <div className={styles.objectSectionHead}>
            <div className={styles.objectSectionTitleGroup}>
              <h3 className={styles.objectSectionTitle}>Footprint</h3>
              <p className={styles.objectSectionSubtitle}>Cómo está Avvale presente en el cliente (texto libre).</p>
            </div>
          </div>
          <div className={styles.objectSectionBody}>
            {editing ? (
              <textarea
                className={styles.textareaLg}
                value={footprint}
                onChange={(e) => setFootprint(e.target.value)}
                placeholder="Ej. implantación regional, partner de referencia en ERP, soporte RUN…"
                aria-label="Footprint Avvale"
              />
            ) : footprint.trim() ? (
              <p className={styles.avvaleFootprintRead}>{footprint}</p>
            ) : (
              <p className={styles.avvaleFootprintReadEmpty}>Sin footprint registrado.</p>
            )}
          </div>
        </div>

        <div className={styles.objectSection}>
          <div className={styles.objectSectionHead}>
            <div className={styles.objectSectionTitleGroup}>
              <h3 className={styles.objectSectionTitle}>Presencia por línea</h3>
              <p className={styles.objectSectionSubtitle}>
                Activa las líneas con presencia y añade una nota corta si lo necesitas.
              </p>
            </div>
          </div>
          <div className={styles.objectSectionBody}>
            <div className={styles.avvaleSolutionChips} role="list" aria-label="Líneas de solución">
              {KYC_SOLUTION_LINES.map(({ slug, label, description }) => {
                const on = presence.includes(slug);
                if (editing) {
                  return (
                    <button
                      key={slug}
                      type="button"
                      title={description}
                      className={`${styles.avvaleSolutionChip} ${on ? styles.avvaleSolutionChipOn : ''}`}
                      onClick={() => togglePresence(slug)}
                      aria-pressed={on}
                    >
                      {label}
                    </button>
                  );
                }
                return (
                  <span
                    key={slug}
                    role="listitem"
                    title={description}
                    className={`${styles.avvaleSolutionChipReadonly} ${on ? styles.avvaleSolutionChipReadonlyOn : ''}`}
                  >
                    {label}
                  </span>
                );
              })}
            </div>
            {editing
              ? presence.map((slug) => {
                  const meta = KYC_SOLUTION_LINES.find((l) => l.slug === slug);
                  return (
                    <div key={slug} className={styles.formRow} style={{ marginTop: '0.75rem' }}>
                      <label className={styles.label} htmlFor={`avvale-note-${slug}`}>
                        Nota — {meta?.label ?? slug}
                      </label>
                      <input
                        id={`avvale-note-${slug}`}
                        className={styles.input}
                        value={solutionNotes[slug] ?? ''}
                        onChange={(e) =>
                          setSolutionNotes((prev) => ({
                            ...prev,
                            [slug]: e.target.value,
                          }))
                        }
                        placeholder={meta?.description ?? ''}
                      />
                    </div>
                  );
                })
              : presence.length > 0
                ? presence.map((slug) => {
                    const meta = KYC_SOLUTION_LINES.find((l) => l.slug === slug);
                    const note = (solutionNotes[slug] ?? '').trim();
                    return (
                      <div key={slug} style={{ marginTop: '0.75rem' }}>
                        <div className={styles.avvaleLineNoteReadLabel}>Nota — {meta?.label ?? slug}</div>
                        {note ? (
                          <p className={styles.avvaleLineNoteRead}>{note}</p>
                        ) : (
                          <p className={styles.avvaleProjectViewEmptyNotes}>Sin nota para esta línea.</p>
                        )}
                      </div>
                    );
                  })
                : (
                    <p className={styles.objectSectionEmpty} style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                      Ninguna línea marcada con presencia.
                    </p>
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
        message="Se perderán las ediciones de footprint y presencia por línea que aún no has guardado."
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
