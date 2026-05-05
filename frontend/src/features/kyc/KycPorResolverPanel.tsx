'use client';

import { useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { kycJson } from './kycApi';
import { KYC_BLOCK_KEYS, KYC_BLOCK_META, type KycBlockKey } from './kycConstants';
import type { KycProfileFocus } from './KycProfileDashboard';
import styles from './kyc-workspace.module.css';

type Q = {
  id: number;
  topic: string;
  question: string;
  priority: number;
  status: string;
  source?: string | null;
  created_at?: string;
  answer?: string | null;
};

const TOPIC_OPTIONS: { value: string; label: string }[] = [
  ...KYC_BLOCK_KEYS.map((k) => ({ value: k, label: KYC_BLOCK_META[k].label })),
  { value: 'competencia', label: 'Competencia / partners' },
  { value: 'org', label: 'Organigrama' },
  { value: 'signals', label: 'Señales' },
  { value: 'general', label: 'General' },
];

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function topicLabel(topic: string): string {
  if ((KYC_BLOCK_KEYS as readonly string[]).includes(topic)) {
    return KYC_BLOCK_META[topic as KycBlockKey].label;
  }
  if (topic === 'competencia') return 'Competencia / partners';
  if (topic === 'org') return 'Organigrama';
  if (topic === 'signals') return 'Señales';
  if (topic === 'general') return 'General';
  return topic;
}

function isBlockEmpty(profile: Record<string, unknown> | null, key: KycBlockKey): boolean {
  if (!profile) return true;
  const data = profile[key];
  return !data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data as object).length === 0;
}

function isCompetenciaEmpty(profile: Record<string, unknown> | null): boolean {
  if (!profile) return true;
  const c = profile.competencia;
  if (!c || typeof c !== 'object' || Array.isArray(c)) return true;
  const items = (c as { items?: unknown }).items;
  if (!Array.isArray(items) || items.length === 0) return true;
  return !items.some((it) => {
    if (!it || typeof it !== 'object' || Array.isArray(it)) return false;
    return String((it as { partner_name?: string }).partner_name ?? '').trim().length > 0;
  });
}

export function KycPorResolverPanel({
  companyId,
  questions,
  profile,
  orgMemberCount,
  onRefetch,
  onBanner,
  onGoProfile,
  onGoOrganigrama,
}: {
  companyId: number;
  questions: Q[];
  profile: Record<string, unknown> | null;
  orgMemberCount: number;
  onRefetch: () => void;
  onBanner: (s: string | null) => void;
  onGoProfile: (focus: KycProfileFocus) => void;
  onGoOrganigrama: () => void;
}) {
  const byTopic = useMemo(() => {
    return questions.reduce<Record<string, Q[]>>((acc, q) => {
      (acc[q.topic] = acc[q.topic] || []).push(q);
      return acc;
    }, {});
  }, [questions]);

  const profileGaps = useMemo(() => KYC_BLOCK_KEYS.filter((k) => isBlockEmpty(profile, k)), [profile]);
  const competenciaGap = useMemo(() => isCompetenciaEmpty(profile), [profile]);

  const [add, setAdd] = useState(false);
  const [res, setRes] = useState<Q | null>(null);
  const [answer, setAnswer] = useState('');
  const [applyToProfile, setApplyToProfile] = useState(true);
  const [applyFieldPath, setApplyFieldPath] = useState('');
  const [newF, setNewF] = useState({ topic: 'general', question: '', priority: '2' });
  const [delId, setDelId] = useState<number | null>(null);

  const doDel = async () => {
    if (delId == null) return;
    onBanner(null);
    const id = delId;
    try {
      await kycJson(`/api/kyc/open-questions/${id}`, { method: 'DELETE' });
      setDelId(null);
      onRefetch();
    } catch (e) {
      onBanner((e as Error).message);
      setDelId(null);
    }
  };

  const submitAdd = async () => {
    if (!newF.question.trim()) return;
    onBanner(null);
    try {
      await kycJson(`/api/kyc/companies/${companyId}/open-questions`, {
        method: 'POST',
        body: JSON.stringify({
          topic: newF.topic.trim() || 'general',
          question: newF.question.trim(),
          priority: parseInt(newF.priority, 10) || 2,
          source: 'manual',
        }),
      });
      setAdd(false);
      setNewF({ topic: 'general', question: '', priority: '2' });
      onRefetch();
    } catch (e) {
      onBanner((e as Error).message);
    }
  };

  const resolveQ = async () => {
    if (!res) return;
    onBanner(null);
    try {
      const body: Record<string, unknown> = {
        status: 'resolved',
        answer: answer || '',
        apply_to_profile: applyToProfile,
      };
      const path = applyFieldPath.trim();
      if (path) body.apply_field_path = path;
      await kycJson(`/api/kyc/open-questions/${res.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setRes(null);
      setAnswer('');
      setApplyFieldPath('');
      setApplyToProfile(true);
      onRefetch();
    } catch (e) {
      onBanner((e as Error).message);
    }
  };

  const skipQ = async (q: Q) => {
    onBanner(null);
    try {
      await kycJson(`/api/kyc/open-questions/${q.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'skipped' }) });
      onRefetch();
    } catch (e) {
      onBanner((e as Error).message);
    }
  };

  const openResolve = (q: Q) => {
    setRes(q);
    setAnswer('');
    setApplyToProfile(true);
    setApplyFieldPath('');
  };

  return (
    <div>
      <header className={styles.porResolverHead}>
        <div>
          <h2 className={styles.porResolverTitle}>Preguntas por resolver</h2>
          <p className={styles.porResolverSub}>
            {questions.length === 0
              ? 'Nada pendiente en esta lista. Puedes completar huecos del perfil o usar la entrevista en el chat.'
              : `${questions.length} pendiente${questions.length === 1 ? '' : 's'}. Responde aquí o en la entrevista guiada; el perfil JSON se puede actualizar al marcar resuelta.`}
          </p>
        </div>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} onClick={() => setAdd(true)}>
          + Pregunta
        </button>
      </header>

      {(profileGaps.length > 0 || orgMemberCount === 0 || competenciaGap) && (
        <section className={styles.porResolverGaps} aria-label="Huecos sugeridos">
          <p className={styles.porResolverGapsTitle}>Completar perfil</p>
          <div className={styles.porResolverGapRow}>
            {profileGaps.map((key) => (
              <button
                key={key}
                type="button"
                className={styles.porResolverGapBtn}
                onClick={() => onGoProfile({ kind: 'block', key })}
              >
                {KYC_BLOCK_META[key].label}
              </button>
            ))}
            {orgMemberCount === 0 ? (
              <button type="button" className={styles.porResolverGapBtn} onClick={onGoOrganigrama}>
                Organigrama (sin personas)
              </button>
            ) : null}
            {competenciaGap ? (
              <button type="button" className={styles.porResolverGapBtn} onClick={() => onGoProfile({ kind: 'competencia' })}>
                Competencia / partners
              </button>
            ) : null}
            <button type="button" className={styles.porResolverGapBtn} onClick={() => onGoProfile({ kind: 'summary' })}>
              Resumen ejecutivo
            </button>
            <button type="button" className={styles.porResolverGapBtn} onClick={() => onGoProfile({ kind: 'ficha' })}>
              Ficha empresa
            </button>
          </div>
        </section>
      )}

      {Object.keys(byTopic).length === 0 ? (
        <p className={styles.hint}>Sin preguntas pendientes en el tablero.</p>
      ) : (
        Object.entries(byTopic).map(([topic, qs]) => (
          <div key={topic} className={styles.oqGroup}>
            <p className={styles.porResolverTopic}>{esc(topicLabel(topic))}</p>
            {qs.map((q) => (
              <div key={q.id} className={styles.oqItem}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className={styles.oqQ}>{esc(q.question)}</div>
                  <div className={styles.hint} style={{ margin: 0 }}>
                    P{q.priority} · {q.source || 'entrevista'}
                    {q.created_at ? ` · ${new Date(q.created_at).toLocaleDateString()}` : ''}
                  </div>
                </div>
                <div className={styles.row} style={{ flexShrink: 0 }}>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSm}`}
                    style={{ color: '#047857', borderColor: '#6ee7b7' }}
                    onClick={() => openResolve(q)}
                  >
                    Resuelta
                  </button>
                  <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => skipQ(q)}>
                    Omitir
                  </button>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSm} ${styles.danger}`}
                    onClick={() => setDelId(q.id)}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))
      )}

      {add && (
        <div className={styles.modalOverlay} onClick={() => setAdd(false)} role="presentation">
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>Añadir pregunta</h2>
            <div className={styles.formRow}>
              <span className={styles.label}>Ámbito</span>
              <select
                className={styles.input}
                value={newF.topic}
                onChange={(e) => setNewF((f) => ({ ...f, topic: e.target.value }))}
              >
                {TOPIC_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formRow}>
              <span className={styles.label}>Pregunta</span>
              <textarea className={styles.textareaLg} value={newF.question} onChange={(e) => setNewF((f) => ({ ...f, question: e.target.value }))} />
            </div>
            <div className={styles.formRow}>
              <span className={styles.label}>Prioridad 1–3</span>
              <input className={styles.input} value={newF.priority} onChange={(e) => setNewF((f) => ({ ...f, priority: e.target.value }))} inputMode="numeric" />
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.btn} onClick={() => setAdd(false)}>
                Cancelar
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={submitAdd}>
                Añadir
              </button>
            </div>
          </div>
        </div>
      )}

      {res && (
        <div className={styles.modalOverlay} onClick={() => setRes(null)} role="presentation">
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>Marcar como resuelta</h2>
            <p className={styles.hint} style={{ marginTop: 0 }}>
              {esc(res.question)}
            </p>
            <div className={styles.formRow}>
              <span className={styles.label}>Respuesta (opcional)</span>
              <textarea className={styles.textareaLg} value={answer} onChange={(e) => setAnswer(e.target.value)} />
            </div>
            <label className={styles.porResolverCheck}>
              <input type="checkbox" checked={applyToProfile} onChange={(e) => setApplyToProfile(e.target.checked)} />
              Guardar la respuesta en el perfil (bloque según el ámbito de la pregunta: p. ej. tech_stack.interview_answer)
            </label>
            <div className={styles.formRow}>
              <span className={styles.label}>Ruta JSON opcional</span>
              <input
                className={styles.input}
                placeholder="Vacío = inferir del ámbito"
                value={applyFieldPath}
                onChange={(e) => setApplyFieldPath(e.target.value)}
              />
            </div>
            <p className={styles.hint} style={{ marginTop: 0 }}>
              Si el ámbito es organigrama o señales, indica una ruta explícita o desmarca guardar en perfil.
            </p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.btn} onClick={() => setRes(null)}>
                Cancelar
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={resolveQ}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={delId != null}
        title="Eliminar pregunta"
        message="Esta pregunta se eliminará del listado."
        onCancel={() => setDelId(null)}
        onConfirm={doDel}
        confirmLabel="Eliminar"
        variant="danger"
        confirmVariant="danger"
      />
    </div>
  );
}
