'use client';

import { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import {
  KYC_COMPETENCIA_AMBITO_LABELS,
  KYC_COMPETENCIA_AMBITOS,
  KYC_COMPETENCIA_MOMENTUM,
  KYC_COMPETENCIA_MOMENTUM_LABELS,
  type KycCompetenciaAmbito,
  type KycCompetenciaMomentum,
} from './kycConstants';
import { KycIconTarget } from './KycInlineIcons';
import styles from './kyc-workspace.module.css';

export type KycCompetenciaRow = {
  localId: string;
  partner_name: string;
  ambitos: KycCompetenciaAmbito[];
  detalle: string;
  analisis: string;
  momentum: KycCompetenciaMomentum;
};

function newLocalId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Clave estable para detectar duplicados (mayúsculas, espacios, acentos). */
export function normalizePartnerKey(name: string): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function pickDisplayName(a: string, b: string): string {
  const ta = a.trim();
  const tb = b.trim();
  if (!ta) return tb;
  if (!tb) return ta;
  if (ta.toLowerCase() === tb.toLowerCase()) return ta.length >= tb.length ? ta : tb;
  return ta;
}

function mergeTextFields(a: string, b: string): string {
  const x = a.trim();
  const y = b.trim();
  if (!x) return y;
  if (!y) return x;
  if (x === y) return x;
  if (x.includes(y)) return x;
  if (y.includes(x)) return y;
  return `${x}\n\n${y}`;
}

function strongerMomentum(a: KycCompetenciaMomentum, b: KycCompetenciaMomentum): KycCompetenciaMomentum {
  const rank: Record<KycCompetenciaMomentum, number> = { bien: 0, neutro: 1, debil: 2, riesgo: 3 };
  return rank[a] >= rank[b] ? a : b;
}

export function mergeCompetenciaRows(primary: KycCompetenciaRow, other: KycCompetenciaRow): KycCompetenciaRow {
  const ambitos = [...new Set([...primary.ambitos, ...other.ambitos])] as KycCompetenciaAmbito[];
  return {
    localId: primary.localId,
    partner_name: pickDisplayName(primary.partner_name, other.partner_name),
    ambitos,
    detalle: mergeTextFields(primary.detalle, other.detalle),
    analisis: mergeTextFields(primary.analisis, other.analisis),
    momentum: strongerMomentum(primary.momentum, other.momentum),
  };
}

/** Una sola fila por partner (nombre normalizado); borradores sin nombre se mantienen aparte. */
export function dedupeCompetenciaRows(rows: KycCompetenciaRow[]): KycCompetenciaRow[] {
  const out: KycCompetenciaRow[] = [];
  const keyToIndex = new Map<string, number>();

  for (const r of rows) {
    const key = normalizePartnerKey(r.partner_name);
    if (!key) {
      out.push(r);
      continue;
    }
    const idx = keyToIndex.get(key);
    if (idx === undefined) {
      keyToIndex.set(key, out.length);
      out.push({ ...r });
    } else {
      out[idx] = mergeCompetenciaRows(out[idx]!, r);
    }
  }
  return out;
}

export function emptyCompetenciaRow(): KycCompetenciaRow {
  return {
    localId: newLocalId(),
    partner_name: '',
    ambitos: [],
    detalle: '',
    analisis: '',
    momentum: 'neutro',
  };
}

export function rowsFromProfileCompetencia(raw: unknown): KycCompetenciaRow[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  const allowed = new Set<string>(KYC_COMPETENCIA_AMBITOS);
  const parsed = items
    .map((it, i) => {
      if (!it || typeof it !== 'object' || Array.isArray(it)) return null;
      const o = it as Record<string, unknown>;
      const ambRaw = o.ambitos;
      const ambitos: KycCompetenciaAmbito[] = [];
      if (Array.isArray(ambRaw)) {
        for (const a of ambRaw) {
          const s = String(a).trim().toLowerCase();
          if (allowed.has(s)) ambitos.push(s as KycCompetenciaAmbito);
        }
      }
      let momentum: KycCompetenciaMomentum = 'neutro';
      const m = String(o.momentum ?? 'neutro').trim().toLowerCase();
      if ((KYC_COMPETENCIA_MOMENTUM as readonly string[]).includes(m)) momentum = m as KycCompetenciaMomentum;
      const partner_name = String(o.partner_name ?? '').trim();
      return {
        localId: `load-${i}-${partner_name || 'x'}`,
        partner_name,
        ambitos,
        detalle: String(o.detalle ?? ''),
        analisis: String(o.analisis ?? ''),
        momentum,
      };
    })
    .filter((r): r is KycCompetenciaRow => r != null);
  return dedupeCompetenciaRows(parsed);
}

export function competenciaPayload(rows: KycCompetenciaRow[]) {
  const filtered = rows.filter((r) => r.partner_name.trim().length > 0);
  const deduped = dedupeCompetenciaRows(filtered);
  return {
    items: deduped.map(({ partner_name, ambitos, detalle, analisis, momentum }) => ({
      partner_name: partner_name.trim(),
      ambitos,
      detalle,
      analisis,
      momentum,
    })),
  };
}

function momentumPillClass(m: KycCompetenciaMomentum): string {
  switch (m) {
    case 'bien':
      return styles.competenciaMomPillBien;
    case 'debil':
      return styles.competenciaMomPillDebil;
    case 'riesgo':
      return styles.competenciaMomPillRiesgo;
    default:
      return styles.competenciaMomPillNeutro;
  }
}

function execPreview(r: KycCompetenciaRow): string {
  const d = r.detalle.trim();
  const a = r.analisis.trim();
  if (!d && !a) return 'Sin detalle capturado aún.';
  if (d && a) return `${d} · ${a}`;
  return d || a;
}

type Props = {
  rows: KycCompetenciaRow[];
  onChange: (rows: KycCompetenciaRow[]) => void;
};

export function KycCompetenciaPanel({ rows, onChange }: Props) {
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (editingId && !rows.some((r) => r.localId === editingId)) setEditingId(null);
  }, [rows, editingId]);

  const updateRow = useCallback(
    (localId: string, patch: Partial<Omit<KycCompetenciaRow, 'localId'>>) => {
      onChange(rows.map((r) => (r.localId === localId ? { ...r, ...patch } : r)));
    },
    [rows, onChange],
  );

  const toggleAmbito = useCallback(
    (localId: string, a: KycCompetenciaAmbito) => {
      const r = rows.find((x) => x.localId === localId);
      if (!r) return;
      const has = r.ambitos.includes(a);
      const ambitos = has ? r.ambitos.filter((x) => x !== a) : [...r.ambitos, a];
      updateRow(localId, { ambitos });
    },
    [rows, updateRow],
  );

  const confirmRemove = useCallback(() => {
    if (!removeId) return;
    onChange(rows.filter((r) => r.localId !== removeId));
    setRemoveId(null);
    setEditingId((id) => (id === removeId ? null : id));
    setExpandedIds((ex) => {
      const n = { ...ex };
      delete n[removeId];
      return n;
    });
  }, [removeId, rows, onChange]);

  const pendingName = rows.find((r) => r.localId === removeId)?.partner_name?.trim() || 'esta fila';

  const runDedupe = useCallback(() => {
    const next = dedupeCompetenciaRows(rows);
    const sameLen = next.length === rows.length;
    const sameIds = sameLen && next.every((r, i) => r.localId === rows[i]?.localId);
    if (sameIds && sameLen) return;
    onChange(next);
    setEditingId((eid) => {
      if (!eid) return null;
      if (next.some((r) => r.localId === eid)) return eid;
      const prev = rows.find((r) => r.localId === eid);
      const k = prev ? normalizePartnerKey(prev.partner_name) : '';
      if (!k) return null;
      const merged = next.find((r) => normalizePartnerKey(r.partner_name) === k);
      return merged?.localId ?? null;
    });
  }, [rows, onChange]);

  const handlePartnerNameBlur = useCallback(() => {
    runDedupe();
  }, [runDedupe]);

  const addPartner = () => {
    const nr = emptyCompetenciaRow();
    onChange([...rows, nr]);
    setEditingId(nr.localId);
  };

  const toggleExpand = (localId: string) => {
    setExpandedIds((p) => ({ ...p, [localId]: !p[localId] }));
  };

  return (
    <>
      <section className={styles.objectSection} id="kyc-focus-competencia">
        <div className={styles.objectSectionHead}>
          <div className={styles.objectSectionTitleGroup}>
            <div className={styles.objectSectionTitleRow}>
              <span className={styles.objectSectionIcon} aria-hidden>
                <KycIconTarget />
              </span>
              <h2 className={styles.objectSectionTitle}>Competencia / partners</h2>
            </div>
            <p className={styles.objectSectionSubtitle}>
              Vista resumen por actor; amplía para leer el detalle. El mismo nombre no se duplica: se fusiona al salir del campo nombre o al
              guardar.
            </p>
          </div>
          <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnPrimary}`} onClick={addPartner}>
            Añadir partner
          </button>
        </div>

        {rows.length === 0 ? (
          <div className={styles.objectSectionBody}>
            <p className={styles.objectSectionEmpty}>Registra consultoras, integradores u otros actores relevantes en la cuenta.</p>
          </div>
        ) : (
          <div className={`${styles.objectSectionBody} ${styles.competenciaList}`}>
            {rows.map((r) => {
              const isDraft = !r.partner_name.trim();
              const isEditing = editingId === r.localId || isDraft;
              const expanded = Boolean(expandedIds[r.localId]);
              const hasDetail = r.detalle.trim().length > 0 || r.analisis.trim().length > 0;

              if (isEditing) {
                return (
                  <div key={r.localId} className={styles.competenciaCard}>
                    <p className={styles.competenciaEditHint}>
                      Modo edición · Los partners con el mismo nombre se unifican automáticamente.
                    </p>
                    <div className={styles.competenciaCardTop}>
                      <input
                        className={styles.input}
                        placeholder="Nombre del partner / actor"
                        value={r.partner_name}
                        onChange={(e) => updateRow(r.localId, { partner_name: e.target.value })}
                        onBlur={handlePartnerNameBlur}
                        aria-label="Nombre del partner"
                      />
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSm} ${styles.btnSecondary}`}
                        onClick={() => {
                          runDedupe();
                          if (!isDraft) setEditingId(null);
                        }}
                      >
                        {isDraft ? 'Guardar vista' : 'Vista resumen'}
                      </button>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSm} ${styles.btnSecondary} ${styles.btnDangerOutline}`}
                        onClick={() => setRemoveId(r.localId)}
                      >
                        Quitar
                      </button>
                    </div>

                    <div className={styles.competenciaField}>
                      <span className={styles.competenciaLabel}>Ámbito</span>
                      <div className={styles.competenciaTags}>
                        {KYC_COMPETENCIA_AMBITOS.map((a) => {
                          const on = r.ambitos.includes(a);
                          return (
                            <button
                              key={a}
                              type="button"
                              className={on ? styles.competenciaTagOn : styles.competenciaTagOff}
                              onClick={() => toggleAmbito(r.localId, a)}
                            >
                              {KYC_COMPETENCIA_AMBITO_LABELS[a]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className={styles.competenciaField}>
                      <span className={styles.competenciaLabel}>Detalle (qué hacen)</span>
                      <textarea
                        className={styles.textareaLg}
                        rows={3}
                        value={r.detalle}
                        onChange={(e) => updateRow(r.localId, { detalle: e.target.value })}
                        placeholder="Alcance, servicios, productos, relación con el cliente…"
                      />
                    </div>

                    <div className={styles.competenciaField}>
                      <span className={styles.competenciaLabel}>Análisis</span>
                      <textarea
                        className={styles.textareaLg}
                        rows={3}
                        value={r.analisis}
                        onChange={(e) => updateRow(r.localId, { analisis: e.target.value })}
                        placeholder="Tu lectura: fortalezas, riesgos, dependencias…"
                      />
                    </div>

                    <div className={styles.competenciaField}>
                      <span className={styles.competenciaLabel}>Momentum en el cliente</span>
                      <select
                        className={styles.input}
                        value={r.momentum}
                        onChange={(e) => updateRow(r.localId, { momentum: e.target.value as KycCompetenciaMomentum })}
                      >
                        {KYC_COMPETENCIA_MOMENTUM.map((m) => (
                          <option key={m} value={m}>
                            {KYC_COMPETENCIA_MOMENTUM_LABELS[m]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              }

              return (
                <div key={r.localId} className={styles.competenciaExecCard}>
                  <div className={styles.competenciaExecHead}>
                    <div className={styles.competenciaExecHeadMain}>
                      <h3 className={styles.competenciaExecTitle}>{r.partner_name.trim() || 'Sin nombre'}</h3>
                      <div className={styles.competenciaExecMeta}>
                        <span className={`${styles.competenciaMomPill} ${momentumPillClass(r.momentum)}`}>
                          {KYC_COMPETENCIA_MOMENTUM_LABELS[r.momentum]}
                        </span>
                        {r.ambitos.map((a) => (
                          <span key={a} className={styles.competenciaChipReadonly}>
                            {KYC_COMPETENCIA_AMBITO_LABELS[a]}
                          </span>
                        ))}
                      </div>
                      <p className={styles.competenciaExecPreview}>{execPreview(r)}</p>
                    </div>
                    <div className={styles.competenciaExecActions}>
                      {hasDetail ? (
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnSm} ${styles.btnSecondary}`}
                          onClick={() => toggleExpand(r.localId)}
                          aria-expanded={expanded}
                        >
                          {expanded ? 'Ocultar detalle' : 'Ampliar'}
                        </button>
                      ) : null}
                      <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnPrimary}`} onClick={() => setEditingId(r.localId)}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSm} ${styles.btnSecondary} ${styles.btnDangerOutline}`}
                        onClick={() => setRemoveId(r.localId)}
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                  {expanded && hasDetail ? (
                    <div className={styles.competenciaExpanded}>
                      {r.detalle.trim() ? (
                        <div className={styles.competenciaExpandedBlock}>
                          <strong>Detalle</strong>
                          <p>{r.detalle.trim()}</p>
                        </div>
                      ) : null}
                      {r.analisis.trim() ? (
                        <div className={styles.competenciaExpandedBlock}>
                          <strong>Análisis</strong>
                          <p>{r.analisis.trim()}</p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={removeId != null}
        title="Quitar partner"
        message={`¿Eliminar ${pendingName} de la lista? Los cambios se guardan al pulsar «Guardar cambios».`}
        variant="danger"
        confirmLabel="Quitar"
        onConfirm={confirmRemove}
        onCancel={() => setRemoveId(null)}
      />
    </>
  );
}
