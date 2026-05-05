'use client';

import { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { kycJson } from './kycApi';
import { KYC_REL_TYPES } from './kycConstants';
import { filterKycOrgChartMembers } from './kycOrgChartFilter';
import styles from './kyc-workspace.module.css';

type M = {
  id: number;
  name: string;
  role: string | null;
  area: string | null;
  level: number | null;
  reports_to_id: number | null;
  linkedin?: string | null;
  notes?: string | null;
};

type R = {
  id: number;
  from_member_id: number;
  to_member_id: number;
  type: string;
};

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

const ORG_LEVELS: { level: number; label: string; hint: string; color: string }[] = [
  { level: 1, label: 'C-Suite', hint: 'CEO · CFO · CTO · COO', color: '#6366f1' },
  { level: 2, label: 'VP / Dirección', hint: 'VP · Director General', color: '#0ea5e9' },
  { level: 3, label: 'Director / Head', hint: 'Director de área · Head', color: '#10b981' },
  { level: 4, label: 'Manager', hint: 'Team Lead · Responsable', color: '#f59e0b' },
  { level: 5, label: 'IC / Analyst', hint: 'Individual contributor', color: '#94a3b8' },
  { level: 0, label: 'Sin asignar', hint: 'Arrástralos a un nivel', color: '#cbd5e1' },
];

const REL_COLORS: Record<string, string> = {
  aliado: '#22c55e',
  bloqueador: '#ef4444',
  influencer: '#f59e0b',
  mentor: '#38bdf8',
  rival: '#8b5cf6',
  otro: '#94a3b8',
};

function areaColor(area: string | null) {
  const a = (area || '').toLowerCase();
  const AREA_COLORS: Record<string, string> = {
    ceo: '#6366f1',
    dirección: '#6366f1',
    general: '#6366f1',
    it: '#0ea5e9',
    sistemas: '#0ea5e9',
    tecnología: '#0ea5e9',
    tech: '#0ea5e9',
    finanzas: '#10b981',
    financiero: '#10b981',
    cfo: '#10b981',
    operaciones: '#f59e0b',
    coo: '#f59e0b',
    comercial: '#ec4899',
    ventas: '#ec4899',
    marketing: '#ec4899',
    rrhh: '#8b5cf6',
    personas: '#8b5cf6',
    hr: '#8b5cf6',
    compras: '#14b8a6',
    procurement: '#14b8a6',
    legal: '#64748b',
  };
  for (const k of Object.keys(AREA_COLORS)) if (a.includes(k)) return AREA_COLORS[k]!;
  return '#64748b';
}

function initials(name: string) {
  return (name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function KycOrgPanel({
  companyId,
  members,
  rels,
  onRefetch,
  onBanner,
}: {
  companyId: number;
  members: M[];
  rels: R[];
  onRefetch: () => void;
  onBanner: (s: string | null) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [edit, setEdit] = useState<M | null>(null);
  const [form, setForm] = useState({
    name: '',
    role: '',
    area: '',
    level: '' as string,
    reports_to_id: '' as string,
    linkedin: '',
    notes: '',
  });
  const [delRelId, setDelRelId] = useState<number | null>(null);
  const [delMemId, setDelMemId] = useState<number | null>(null);
  const [dragSrcId, setDragSrcId] = useState<number | null>(null);
  const [laneHint, setLaneHint] = useState<number | null>(null);
  const [relMenu, setRelMenu] = useState<{ srcId: number; targetId: number; x: number; y: number } | null>(null);
  const [dropTargetId, setDropTargetId] = useState<number | null>(null);
  const [addRelOpen, setAddRelOpen] = useState(false);
  const [relForm, setRelForm] = useState<{ fromId: string; toId: string; kind: string }>({ fromId: '', toId: '', kind: 'aliado' });

  /** Solo estructura interna; partners tecnológicos y competencia quedan fuera del tablero. */
  const visibleMembers = useMemo(() => filterKycOrgChartMembers(members), [members]);
  const hiddenOrgCount = members.length - visibleMembers.length;

  const allById: Record<number, M> = useMemo(() => Object.fromEntries(members.map((m) => [Number(m.id), m] as const)), [members]);
  const byId: Record<number, M> = useMemo(
    () => Object.fromEntries(visibleMembers.map((m) => [Number(m.id), m] as const)),
    [visibleMembers],
  );

  const visibleMemberIds = useMemo(() => new Set(visibleMembers.map((m) => Number(m.id))), [visibleMembers]);
  const relsVisible = useMemo(
    () => rels.filter((r) => visibleMemberIds.has(Number(r.from_member_id)) && visibleMemberIds.has(Number(r.to_member_id))),
    [rels, visibleMemberIds],
  );

  const buckets = useMemo(() => {
    const b: Record<number, M[]> = {};
    for (const L of ORG_LEVELS) b[L.level] = [];
    for (const m of visibleMembers) {
      const lvl = Number.isInteger(m.level) && (m.level as number) >= 1 && (m.level as number) <= 5 ? (m.level as number) : 0;
      b[lvl].push(m);
    }
    for (const k of Object.keys(b)) {
      b[Number(k)]!.sort((a, c) => {
        const pa = a.reports_to_id || 0;
        const pb = c.reports_to_id || 0;
        if (pa !== pb) return pa - pb;
        return (a.name || '').localeCompare(c.name || '');
      });
    }
    return b;
  }, [visibleMembers]);

  const addDummyProfiles = async () => {
    onBanner(null);
    const dummies: Array<Record<string, unknown>> = [
      { name: 'María López', role: 'CEO', area: 'Dirección', level: 1, notes: 'Ejemplo: decisora final', source: 'example' },
      { name: 'Javier Martín', role: 'CFO', area: 'Finanzas', level: 1, notes: 'Ejemplo: controla presupuesto', source: 'example' },
      { name: 'Lucía García', role: 'CTO', area: 'IT', level: 1, notes: 'Ejemplo: sponsor tecnológico', source: 'example' },
      { name: 'Álvaro Ruiz', role: 'Director de Compras', area: 'Compras', level: 2, notes: 'Ejemplo: gatekeeper', source: 'example' },
      { name: 'Sofía Pérez', role: 'Head of Operations', area: 'Operaciones', level: 3, notes: 'Ejemplo: dueña de proceso', source: 'example' },
      { name: 'Carlos Sánchez', role: 'Analista BI', area: 'Datos/BI', level: 5, notes: 'Ejemplo: usuario avanzado', source: 'example' },
    ];
    try {
      for (const d of dummies) {
        await kycJson(`/api/kyc/companies/${companyId}/org/members`, {
          method: 'POST',
          body: JSON.stringify({ ...d, reports_to_id: null, linkedin: null }),
        });
      }
      onRefetch();
      onBanner('Perfiles de ejemplo añadidos al organigrama.');
    } catch (e) {
      onBanner(String(e instanceof Error ? e.message : e));
    }
  };

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!relMenu) return;
      const el = document.getElementById('kyc-rel-menu');
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setRelMenu(null);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [relMenu]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setRelMenu(null);
        setAddRelOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const openAdd = () => {
    setForm({ name: '', role: '', area: '', level: '', reports_to_id: '', linkedin: '', notes: '' });
    setAddOpen(true);
  };
  const openEdit = (m: M) => {
    setForm({
      name: m.name,
      role: m.role ?? '',
      area: m.area ?? '',
      level: m.level != null ? String(m.level) : '',
      reports_to_id: m.reports_to_id != null ? String(m.reports_to_id) : '',
      linkedin: m.linkedin ?? '',
      notes: m.notes ?? '',
    });
    setEdit(m);
  };
  const submitAdd = async () => {
    if (!form.name.trim()) return;
    onBanner(null);
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      role: form.role || null,
      area: form.area || null,
      linkedin: form.linkedin || null,
      notes: form.notes || null,
    };
    if (form.level.trim() !== '') {
      const n = parseInt(form.level, 10);
      if (n >= 1 && n <= 5) body.level = n;
      else if (n === 0) body.level = null;
    }
    if (form.reports_to_id.trim() !== '') {
      const rid = parseInt(form.reports_to_id, 10);
      if (members.some((m) => m.id === rid)) body.reports_to_id = rid;
    }
    await kycJson(`/api/kyc/companies/${companyId}/org/members`, { method: 'POST', body: JSON.stringify(body) });
    setAddOpen(false);
    onRefetch();
  };
  const submitEdit = async () => {
    if (!edit) return;
    onBanner(null);
    const body: Record<string, unknown> = {
      name: form.name.trim() || undefined,
      role: form.role || null,
      area: form.area || null,
      linkedin: form.linkedin || null,
      notes: form.notes || null,
    };
    if (form.level.trim() === '') body.level = null;
    else {
      const n = parseInt(form.level, 10);
      if (n >= 1 && n <= 5) body.level = n;
      else body.level = null;
    }
    if (form.reports_to_id.trim() === '') body.reports_to_id = null;
    else {
      const rid = parseInt(form.reports_to_id, 10);
      body.reports_to_id = members.some((m) => m.id === rid) ? rid : null;
    }
    await kycJson(`/api/kyc/org/members/${edit.id}`, { method: 'PATCH', body: JSON.stringify(body) });
    setEdit(null);
    onRefetch();
  };

  // ... resto del componente
  const doDelRel = async () => {
    if (delRelId == null) return;
    onBanner(null);
    await kycJson(`/api/kyc/org/relationships/${delRelId}`, { method: 'DELETE' });
    setDelRelId(null);
    onRefetch();
  };
  const doDelMem = async () => {
    if (delMemId == null) return;
    onBanner(null);
    await kycJson(`/api/kyc/org/members/${delMemId}`, { method: 'DELETE' });
    setDelMemId(null);
    onRefetch();
  };

  const laneDrop = async (newLevel: number) => {
    const srcId = dragSrcId;
    setLaneHint(null);
    setDragSrcId(null);
    if (!srcId) return;
    const m = allById[srcId];
    if (!m) return;
    const cur = Number.isInteger(m.level) && (m.level as number) >= 1 && (m.level as number) <= 5 ? (m.level as number) : 0;
    if (cur === newLevel) return;
    try {
      await kycJson(`/api/kyc/org/members/${srcId}`, {
        method: 'PATCH',
        body: JSON.stringify({ level: newLevel === 0 ? null : newLevel }),
      });
      onRefetch();
    } catch (e) {
      onBanner((e as Error).message);
    }
  };

  const openRelMenu = (srcId: number, targetId: number, x: number, y: number) => {
    if (srcId === targetId) return;
    setRelMenu({
      srcId,
      targetId,
      x: Math.min(x, window.innerWidth - 280),
      y: Math.min(y, window.innerHeight - 320),
    });
  };

  const applyFormalReport = async (srcId: number, targetId: number) => {
    setRelMenu(null);
    try {
      const tgt = allById[targetId];
      const parentLvl = Number.isInteger(tgt?.level) ? (tgt.level as number) : 0;
      const childLvl = Math.min(5, Math.max(1, (parentLvl || 0) + 1));
      await kycJson(`/api/kyc/org/members/${srcId}`, {
        method: 'PATCH',
        body: JSON.stringify({ reports_to_id: targetId, level: childLvl }),
      });
      onRefetch();
    } catch (e) {
      onBanner((e as Error).message);
    }
  };

  const applyInformalRel = async (srcId: number, targetId: number, type: string) => {
    setRelMenu(null);
    try {
      await kycJson(`/api/kyc/companies/${companyId}/org/relationships`, {
        method: 'POST',
        body: JSON.stringify({ from_member_id: srcId, to_member_id: targetId, type }),
      });
      onRefetch();
    } catch (e) {
      onBanner((e as Error).message);
    }
  };

  const submitRelModal = async () => {
    const a = parseInt(relForm.fromId, 10);
    const b = parseInt(relForm.toId, 10);
    if (!a || !b || a === b) {
      onBanner('Selecciona dos personas distintas.');
      return;
    }
    try {
      await kycJson(`/api/kyc/companies/${companyId}/org/relationships`, {
        method: 'POST',
        body: JSON.stringify({ from_member_id: a, to_member_id: b, type: relForm.kind || 'otro' }),
      });
      setAddRelOpen(false);
      setRelForm({ fromId: '', toId: '', kind: 'aliado' });
      onRefetch();
    } catch (e) {
      onBanner((e as Error).message);
    }
  };

  return (
    <div>
      <div className={styles.orgHeader}>
        <div>
          <div className={styles.orgTitle}>
            Organigrama · {visibleMembers.length} {visibleMembers.length === 1 ? 'persona' : 'personas'}
            {hiddenOrgCount > 0 ? (
              <span className={styles.orgHiddenHint}> ({hiddenOrgCount} ocultas: partner tech / competencia)</span>
            ) : null}
          </div>
          <div className={styles.orgSub}>
            Solo estructura interna. Partners tecnológicos y competencia no se muestran aquí (siguen en datos si los añadió el modelo).
          </div>
        </div>
        <div className={styles.row}>
          <button type="button" className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`} onClick={() => void addDummyProfiles()}>
            + Ejemplos
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`} onClick={() => setAddRelOpen(true)}>
            + Relación
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} onClick={openAdd}>
            + Miembro
          </button>
        </div>
      </div>

      <div className={styles.orgTip}>
        💡 <strong>Tip:</strong> arrastra a una <strong>fila</strong> para cambiar el nivel · arrastra sobre <strong>otra persona</strong> para “reporta a” o relación informal (aliado, bloqueador…).
      </div>

      <div className={styles.relLegend}>
        {KYC_REL_TYPES.map((t) => (
          <span key={t} className={styles.relLegendChip}>
            <svg width="18" height="6" aria-hidden="true">
              <line x1="0" y1="3" x2="18" y2="3" stroke={REL_COLORS[t]} strokeWidth="2" strokeDasharray="3 2" />
            </svg>
            <span className={styles.relLegendLabel}>{t}</span>
          </span>
        ))}
      </div>

      <div className={styles.orgBoard}>
        {ORG_LEVELS.map((L) => {
          const laneMembers = buckets[L.level] || [];
          return (
            <div
              key={L.level}
              className={`${styles.orgLane} ${laneHint === L.level ? styles.orgLaneHint : ''}`}
              onDragOver={(e) => {
                if (dragSrcId == null) return;
                e.preventDefault();
                setLaneHint(L.level);
                const scroller = (e.currentTarget as HTMLElement).closest('main');
                if (scroller) {
                  const r = scroller.getBoundingClientRect();
                  const topDist = e.clientY - r.top;
                  const botDist = r.bottom - e.clientY;
                  const step = 22;
                  if (topDist < 80) scroller.scrollBy({ top: -step });
                  else if (botDist < 80) scroller.scrollBy({ top: step });
                }
              }}
              onDragLeave={() => setLaneHint(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDropTargetId(null);
                void laneDrop(L.level);
              }}
            >
              <div className={styles.orgLaneHead} style={{ background: `linear-gradient(90deg, ${L.color}14, transparent)` }}>
                <div className={styles.orgLaneLabel} style={{ color: L.color }}>
                  {L.label}
                </div>
                <div className={styles.orgLaneHint}>{L.hint}</div>
                <div className={styles.orgLaneCount}>{laneMembers.length} {laneMembers.length === 1 ? 'persona' : 'personas'}</div>
              </div>
              <div className={styles.orgLaneBody}>
                {laneMembers.length === 0 ? (
                  <div className={styles.orgLaneEmpty}>Arrastra aquí para asignar {L.label}</div>
                ) : (
                  laneMembers.map((m) => {
                    const col = areaColor(m.area);
                    const parent = m.reports_to_id ? byId[Number(m.reports_to_id)] : null;
                    return (
                      <div
                        key={m.id}
                        className={`${styles.orgCard} ${dropTargetId === m.id ? styles.orgCardDropTarget : ''}`}
                        style={{ borderTopColor: col }}
                        draggable
                        onDragStart={(e) => {
                          setDragSrcId(m.id);
                          setDropTargetId(null);
                          try {
                            e.dataTransfer.setData('text/plain', String(m.id));
                          } catch {
                            /* empty */
                          }
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={() => {
                          setDragSrcId(null);
                          setLaneHint(null);
                          setDropTargetId(null);
                        }}
                        onDragOver={(e) => {
                          if (dragSrcId == null) return;
                          e.preventDefault();
                          setDropTargetId(m.id);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const srcId = dragSrcId ?? Number(e.dataTransfer.getData('text/plain'));
                          setDragSrcId(null);
                          setLaneHint(null);
                          setDropTargetId(null);
                          if (!srcId) return;
                          openRelMenu(srcId, m.id, e.clientX, e.clientY);
                        }}
                      >
                        <div className={styles.orgAvatar} style={{ background: col }}>
                          {initials(m.name)}
                        </div>
                        <div className={styles.orgCardText}>
                          <div className={styles.orgCardName}>{esc(m.name)}</div>
                          <div className={styles.orgCardRole}>{esc(m.role || '—')}</div>
                          {m.area ? (
                            <div className={styles.orgCardArea} style={{ color: col }}>
                              {esc(m.area)}
                            </div>
                          ) : null}
                          {parent ? <div className={styles.orgCardParent}>⬆ {esc(parent.name)}</div> : null}
                        </div>
                        <button type="button" className={styles.orgCardDel} onClick={() => setDelMemId(m.id)}>
                          ×
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {relsVisible.length > 0 ? (
        <div className={styles.orgRelsBox}>
          <div className={styles.orgRelsTitle}>Relaciones informales</div>
          <div className={styles.orgRelsList}>
            {relsVisible.map((r) => {
              const f = allById[Number(r.from_member_id)];
              const t = allById[Number(r.to_member_id)];
              const col = REL_COLORS[r.type] || REL_COLORS.otro;
              return (
                <div key={r.id} className={styles.orgRelRow}>
                  <span>
                    <strong>{esc(f?.name || '?')}</strong> → <strong>{esc(t?.name || '?')}</strong>{' '}
                    <span className={styles.orgRelType} style={{ background: col }}>
                      {esc(r.type)}
                    </span>
                  </span>
                  <button type="button" className={styles.orgRelDel} onClick={() => setDelRelId(r.id)}>
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {relMenu && (
        <div
          id="kyc-rel-menu"
          className={styles.relMenu}
          style={{ left: relMenu.x, top: relMenu.y }}
          role="dialog"
          aria-label="Relación"
        >
          <div className={styles.relMenuHead}>
            <strong>{esc(byId[relMenu.srcId]?.name || '?')}</strong> <span>→</span>{' '}
            <strong>{esc(byId[relMenu.targetId]?.name || '?')}</strong>
          </div>
          <div className={styles.relMenuSection}>
            <button type="button" className={styles.relMenuBtnPrimary} onClick={() => void applyFormalReport(relMenu.srcId, relMenu.targetId)}>
              ⬆ Reporta a (jerarquía formal)
            </button>
            <div className={styles.relMenuCaption}>Relación informal</div>
            {KYC_REL_TYPES.map((t) => (
              <button key={t} type="button" className={styles.relMenuBtn} onClick={() => void applyInformalRel(relMenu.srcId, relMenu.targetId, t)}>
                <span className={styles.relDot} style={{ background: REL_COLORS[t] }} /> <span className={styles.relLegendLabel}>{t}</span>
              </button>
            ))}
          </div>
          <button type="button" className={styles.relMenuCancel} onClick={() => setRelMenu(null)}>
            Cancelar
          </button>
        </div>
      )}

      {addRelOpen && (
        <div className={styles.modalOverlay} onClick={() => setAddRelOpen(false)} role="presentation">
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>Nueva relación</h2>
            <div className={styles.formRow}>
              <span className={styles.label}>Desde</span>
              <select className={styles.input} value={relForm.fromId} onChange={(e) => setRelForm((r) => ({ ...r, fromId: e.target.value }))}>
                <option value="">—</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} #{m.id}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formRow}>
              <span className={styles.label}>Hacia</span>
              <select className={styles.input} value={relForm.toId} onChange={(e) => setRelForm((r) => ({ ...r, toId: e.target.value }))}>
                <option value="">—</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} #{m.id}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formRow}>
              <span className={styles.label}>Tipo</span>
              <select className={styles.input} value={relForm.kind} onChange={(e) => setRelForm((r) => ({ ...r, kind: e.target.value }))}>
                {KYC_REL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.btn} onClick={() => setAddRelOpen(false)}>
                Cancelar
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={submitRelModal}>
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

      {addOpen && (
        <div className={styles.modalOverlay} onClick={() => setAddOpen(false)} role="presentation">
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>Añadir miembro</h2>
            <div className={styles.formRow}>
              <span className={styles.label}>Nombre</span>
              <input className={styles.input} value={form.name} onChange={(e) => setForm((x) => ({ ...x, name: e.target.value }))} />
            </div>
            <div className={styles.formRow}>
              <span className={styles.label}>Rol</span>
              <input className={styles.input} value={form.role} onChange={(e) => setForm((x) => ({ ...x, role: e.target.value }))} />
            </div>
            <div className={styles.formRow}>
              <span className={styles.label}>Área</span>
              <input className={styles.input} value={form.area} onChange={(e) => setForm((x) => ({ ...x, area: e.target.value }))} />
            </div>
            <div className={styles.formRow}>
              <span className={styles.label}>LinkedIn</span>
              <input className={styles.input} value={form.linkedin} onChange={(e) => setForm((x) => ({ ...x, linkedin: e.target.value }))} />
            </div>
            <div className={styles.formRow}>
              <span className={styles.label}>Notas</span>
              <textarea className={styles.textareaLg} value={form.notes} onChange={(e) => setForm((x) => ({ ...x, notes: e.target.value }))} style={{ minHeight: '2.5rem' }} />
            </div>
            <div className={styles.formRow}>
              <span className={styles.label}>Nivel 1-5 (vacío = —)</span>
              <input className={styles.input} value={form.level} onChange={(e) => setForm((x) => ({ ...x, level: e.target.value }))} inputMode="numeric" />
            </div>
            <div className={styles.formRow}>
              <span className={styles.label}>Reporta a (ID de miembro)</span>
              <input className={styles.input} value={form.reports_to_id} onChange={(e) => setForm((x) => ({ ...x, reports_to_id: e.target.value }))} />
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.btn} onClick={() => setAddOpen(false)}>
                Cancelar
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={submitAdd}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
      {edit && (
        <div className={styles.modalOverlay} onClick={() => setEdit(null)} role="presentation">
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>Editar miembro</h2>
            <div className={styles.formRow}>
              <span className={styles.label}>Nombre</span>
              <input className={styles.input} value={form.name} onChange={(e) => setForm((x) => ({ ...x, name: e.target.value }))} />
            </div>
            <div className={styles.formRow}>
              <span className={styles.label}>Rol</span>
              <input className={styles.input} value={form.role} onChange={(e) => setForm((x) => ({ ...x, role: e.target.value }))} />
            </div>
            <div className={styles.formRow}>
              <span className={styles.label}>Área</span>
              <input className={styles.input} value={form.area} onChange={(e) => setForm((x) => ({ ...x, area: e.target.value }))} />
            </div>
            <div className={styles.formRow}>
              <span className={styles.label}>LinkedIn</span>
              <input className={styles.input} value={form.linkedin} onChange={(e) => setForm((x) => ({ ...x, linkedin: e.target.value }))} />
            </div>
            <div className={styles.formRow}>
              <span className={styles.label}>Notas</span>
              <textarea
                className={styles.textareaLg}
                value={form.notes}
                onChange={(e) => setForm((x) => ({ ...x, notes: e.target.value }))}
                style={{ minHeight: '2.5rem' }}
              />
            </div>
            <div className={styles.formRow}>
              <span className={styles.label}>Nivel 1-5 (vacío = null)</span>
              <input className={styles.input} value={form.level} onChange={(e) => setForm((x) => ({ ...x, level: e.target.value }))} inputMode="numeric" />
            </div>
            <div className={styles.formRow}>
              <span className={styles.label}>Reporta a (ID, vacío = null)</span>
              <input className={styles.input} value={form.reports_to_id} onChange={(e) => setForm((x) => ({ ...x, reports_to_id: e.target.value }))} />
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.btn} onClick={() => setEdit(null)}>
                Cancelar
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={submitEdit}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={delRelId != null}
        title="Quitar relación"
        message="Se elimina esta relación de influencia. ¿Continuar?"
        onCancel={() => setDelRelId(null)}
        onConfirm={doDelRel}
        confirmLabel="Eliminar"
        variant="danger"
        confirmVariant="danger"
      />
      <ConfirmDialog
        open={delMemId != null}
        title="Eliminar miembro"
        message="¿Quitar a esta persona del organigrama KYC?"
        onCancel={() => setDelMemId(null)}
        onConfirm={doDelMem}
        confirmLabel="Eliminar"
        variant="danger"
        confirmVariant="danger"
      />
    </div>
  );
}
