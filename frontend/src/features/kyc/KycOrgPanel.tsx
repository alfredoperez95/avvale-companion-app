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

/** Orden visual del tablero (arriba → abajo). VP / Dirección va primero; los `level` guardados en API no cambian. */
const ORG_BOARD_LEVEL_ORDER = [2, 1, 3, 4, 5, 0] as const;

const ORG_LEVEL_BY_NUM = new Map(ORG_LEVELS.map((L) => [L.level, L]));

function orderedOrgLevelsForBoard(): typeof ORG_LEVELS {
  return ORG_BOARD_LEVEL_ORDER.map((n) => ORG_LEVEL_BY_NUM.get(n)).filter(Boolean) as typeof ORG_LEVELS;
}

/** Nivel normalizado igual que en `buckets` (1–5 o 0 sin asignar). */
function orgLevelCanonical(level: number | null | undefined): number {
  if (level == null || !Number.isFinite(Number(level))) return 0;
  const n = Number(level);
  if (n >= 1 && n <= 5) return n;
  return 0;
}

/** Color del carril / tarjeta según nivel (alineado con `ORG_LEVELS`, no con el área funcional). */
function orgLevelColor(level: number | null | undefined): string {
  return ORG_LEVEL_BY_NUM.get(orgLevelCanonical(level))?.color ?? '#cbd5e1';
}

/** Color de iniciales en el avatar según luminancia del fondo. */
function contrastInkForBg(hex: string): '#fff' | '#0f172a' {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim());
  if (!m) return '#fff';
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.62 ? '#0f172a' : '#fff';
}

function OrgLevelSelect({
  className,
  value,
  onChange,
}: {
  className: string;
  value: string;
  onChange: (level: string) => void;
}) {
  return (
    <select className={className} value={value === '' ? '0' : value} onChange={(e) => onChange(e.target.value)}>
      {ORG_BOARD_LEVEL_ORDER.filter((lvl) => lvl >= 1).map((lvl) => {
        const L = ORG_LEVEL_BY_NUM.get(lvl);
        if (!L) return null;
        return (
          <option key={L.level} value={String(L.level)}>
            {L.label}
          </option>
        );
      })}
      <option value="0">{ORG_LEVELS.find((L) => L.level === 0)?.label ?? 'Sin asignar'}</option>
    </select>
  );
}

function OrgReportsToSelect({
  className,
  members,
  value,
  onChange,
  excludeMemberId,
}: {
  className: string;
  members: M[];
  value: string;
  onChange: (reportsToId: string) => void;
  excludeMemberId?: number | null;
}) {
  const candidates = useMemo(
    () =>
      [...members]
        .filter((m) => excludeMemberId == null || m.id !== excludeMemberId)
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })),
    [members, excludeMemberId],
  );

  const selectedNum = value.trim() === '' ? null : parseInt(value, 10);
  const showStaleOption =
    selectedNum != null &&
    Number.isFinite(selectedNum) &&
    !candidates.some((m) => m.id === selectedNum);
  const staleLabel =
    selectedNum != null && Number.isFinite(selectedNum)
      ? (() => {
          const ref = members.find((m) => m.id === selectedNum);
          if (ref) return `${ref.name}${ref.role ? ` · ${ref.role}` : ''}`;
          return `#${selectedNum}`;
        })()
      : '';

  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Sin jefe directo</option>
      {showStaleOption && (
        <option value={String(selectedNum)}>{`${staleLabel} (referencia actual)`}</option>
      )}
      {candidates.map((m) => (
        <option key={m.id} value={String(m.id)}>
          {m.name}
          {m.role ? ` · ${m.role}` : ''}
        </option>
      ))}
    </select>
  );
}

const REL_COLORS: Record<string, string> = {
  aliado: '#22c55e',
  bloqueador: '#ef4444',
  influencer: '#f59e0b',
  mentor: '#38bdf8',
  rival: '#8b5cf6',
  otro: '#94a3b8',
};

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
  companyName,
  members,
  rels,
  onRefetch,
  onBanner,
}: {
  companyId: number;
  /** Razón social / nombre de la ficha KYC (búsqueda LinkedIn «people»). */
  companyName: string;
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
  /** Menú ⋯ en tarjeta de miembro (editar / eliminar). */
  const [orgCardMenuId, setOrgCardMenuId] = useState<number | null>(null);

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

  /** Misma base que LinkedIn UI; `keywords` codificado (espacios y caracteres especiales en nombre de empresa). */
  const linkedinPeopleSearchUrl = useMemo(() => {
    const q = companyName.trim() || 'Empresa';
    return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}`;
  }, [companyName]);

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
    if (orgCardMenuId == null) return;
    const onDoc = (e: MouseEvent) => {
      const root = document.querySelector(`[data-org-card-menu="${orgCardMenuId}"]`);
      if (root && e.target instanceof Node && root.contains(e.target)) return;
      setOrgCardMenuId(null);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [orgCardMenuId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setRelMenu(null);
        setAddRelOpen(false);
        setOrgCardMenuId(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const openAdd = () => {
    setForm({ name: '', role: '', area: '', level: '0', reports_to_id: '', linkedin: '', notes: '' });
    setAddOpen(true);
  };
  const openEdit = (m: M) => {
    const lvl =
      m.level != null && Number.isInteger(m.level) && (m.level as number) >= 1 && (m.level as number) <= 5
        ? String(m.level)
        : '0';
    setForm({
      name: m.name,
      role: m.role ?? '',
      area: m.area ?? '',
      level: lvl,
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
    const n = parseInt(form.level || '0', 10);
    body.level = Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
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
    const n = parseInt(form.level || '0', 10);
    body.level = Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
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
    setOrgCardMenuId(null);
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
              <span className={styles.orgHiddenHint}> ({hiddenOrgCount} ocultas: partner tech / competencia (Avvale))</span>
            ) : null}
          </div>
          <div className={styles.orgSub}>
            Solo estructura interna. Partners tecnológicos y competencia (respecto a Avvale) no se muestran aquí (siguen en datos si los añadió el
            modelo).
          </div>
        </div>
        <div className={styles.row}>
          <button type="button" className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`} onClick={() => setAddRelOpen(true)}>
            + Relación
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} onClick={openAdd}>
            + Miembro
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnLinkedIn} ${styles.btnSm}`}
            onClick={() => window.open(linkedinPeopleSearchUrl, '_blank', 'noopener,noreferrer')}
            aria-label={`Abrir búsqueda de personas en LinkedIn para ${companyName.trim() || 'Empresa'}`}
          >
            + LinkedIn
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
        {orderedOrgLevelsForBoard().map((L) => {
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
                    const laneCol = orgLevelColor(m.level);
                    const parent = m.reports_to_id ? byId[Number(m.reports_to_id)] : null;
                    return (
                      <div
                        key={m.id}
                        className={`${styles.orgCard} ${dropTargetId === m.id ? styles.orgCardDropTarget : ''}`}
                        style={{ borderTopColor: laneCol }}
                        draggable
                        onDragStart={(e) => {
                          setOrgCardMenuId(null);
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
                        <div
                          className={styles.orgAvatar}
                          style={{ background: laneCol, color: contrastInkForBg(laneCol) }}
                        >
                          {initials(m.name)}
                        </div>
                        <div className={styles.orgCardText}>
                          <div className={styles.orgCardName}>{esc(m.name)}</div>
                          <div className={styles.orgCardRole}>{esc(m.role || '—')}</div>
                          {m.area ? <div className={styles.orgCardArea}>{esc(m.area)}</div> : null}
                          {parent ? <div className={styles.orgCardParent}>⬆ {esc(parent.name)}</div> : null}
                        </div>
                        <div className={styles.orgCardMenuWrap} data-org-card-menu={m.id}>
                          <button
                            type="button"
                            className={styles.orgCardMenuTrigger}
                            aria-label="Más acciones"
                            aria-expanded={orgCardMenuId === m.id}
                            aria-haspopup="menu"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOrgCardMenuId((id) => (id === m.id ? null : m.id));
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                              <circle cx="5" cy="12" r="2" fill="currentColor" />
                              <circle cx="12" cy="12" r="2" fill="currentColor" />
                              <circle cx="19" cy="12" r="2" fill="currentColor" />
                            </svg>
                          </button>
                          {orgCardMenuId === m.id ? (
                            <div className={styles.orgCardMenu} role="menu" aria-label="Acciones del miembro">
                              <button
                                type="button"
                                role="menuitem"
                                className={styles.orgCardMenuItem}
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOrgCardMenuId(null);
                                  openEdit(m);
                                }}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                className={`${styles.orgCardMenuItem} ${styles.orgCardMenuItemDanger}`}
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOrgCardMenuId(null);
                                  setDelMemId(m.id);
                                }}
                              >
                                Eliminar
                              </button>
                            </div>
                          ) : null}
                        </div>
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
              <span className={styles.label}>Nivel</span>
              <OrgLevelSelect className={styles.input} value={form.level} onChange={(level) => setForm((x) => ({ ...x, level }))} />
            </div>
            <div className={styles.formRow}>
              <span className={styles.label}>Reporta a</span>
              <OrgReportsToSelect
                className={styles.input}
                members={members}
                value={form.reports_to_id}
                onChange={(reports_to_id) => setForm((x) => ({ ...x, reports_to_id }))}
              />
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
              <span className={styles.label}>Nivel</span>
              <OrgLevelSelect className={styles.input} value={form.level} onChange={(level) => setForm((x) => ({ ...x, level }))} />
            </div>
            <div className={styles.formRow}>
              <span className={styles.label}>Reporta a</span>
              <OrgReportsToSelect
                className={styles.input}
                members={members}
                value={form.reports_to_id}
                excludeMemberId={edit.id}
                onChange={(reports_to_id) => setForm((x) => ({ ...x, reports_to_id }))}
              />
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
