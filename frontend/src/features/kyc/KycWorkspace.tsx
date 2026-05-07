'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { kycJson, kycStreamChat } from './kycApi';
import { buildKycChatQuickActions } from './kycChatQuickActions';
import { formatKycAssistantMessageHtml, stripKycProposedJsonFromChatText } from './kycChatMessageFormat';
import { filterKycOrgChartMembers } from './kycOrgChartFilter';
import { KycOrgPanel } from './KycOrgPanel';
import { KycPorResolverPanel } from './KycPorResolverPanel';
import { KycProfileDashboard, type KycProfileFocus } from './KycProfileDashboard';
import { KycSignalsPanel } from './KycSignalsPanel';
import { KycStackView } from './KycStackView';
import { USER_INDUSTRY_OPTIONS, industryLabel, type UserIndustryValue } from '@/lib/user-industry';
import styles from './kyc-workspace.module.css';

type CompanyRow = {
  id: number;
  name: string;
  sector: string | null;
  industry?: string | null;
  website: string | null;
  city: string | null;
  kyc_active?: boolean;
  strategic?: boolean | null;
  completeness: number;
  signal_count: number;
  org_count?: number;
  revenue?: string | null;
  employees?: string | null;
  summary?: string | null;
};

type OrgMember = {
  id: number;
  name: string;
  role: string | null;
  area: string | null;
  level: number | null;
  reports_to_id: number | null;
  linkedin?: string | null;
  notes?: string | null;
};

type OpenQ = {
  id: number;
  topic: string;
  question: string;
  priority: number;
  status: string;
  source?: string | null;
  created_at?: string;
  answer?: string | null;
};

type Full = {
  company: Record<string, unknown>;
  profile: Record<string, unknown> | null;
  completeness: number;
  org: { members: OrgMember[]; relationships: { id: number; from_member_id: number; to_member_id: number; type: string }[] };
  signals: Record<string, unknown>[];
  open_questions: OpenQ[];
};

type ChatMsg = { id?: number; role: string; content: string; created_at?: string };
type SessionRow = { id: number; title: string | null; session_type?: string };

const TABS = [
  ['dashboard', 'Resumen'],
  ['organigrama', 'Organigrama'],
  ['stack', 'Tecnología'],
  ['por_resolver', 'Por resolver'],
  ['signals', 'Señales'],
] as const;

type KycWorkspaceProps = { className?: string; initialCompanyId?: number | null };

function escapeHtml(s: string) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function slugify(s: string): string {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 64);
}

function companyListMeta(c: { sector: string | null; city: string | null }) {
  const parts = [String(c.sector ?? '').trim(), String(c.city ?? '').trim()].filter((s) => s.length > 0);
  return parts.length > 0 ? parts.join(' · ') : 'Sin sector ni ciudad';
}

export default function KycWorkspace({
  className,
  initialCompanyId = null,
}: KycWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prevModalRef = useRef<'add' | 'import' | null>(null);

  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [search, setSearch] = useState('');
  const [strategicOnly, setStrategicOnly] = useState(false);
  const [listErr, setListErr] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [selId, setSelId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Full | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>(() => {
    if (typeof window === 'undefined') return 'dashboard';
    const saved = window.localStorage.getItem('kyc_tab') || '';
    return (TABS.some(([id]) => id === saved) ? saved : 'dashboard') as (typeof TABS)[number][0];
  });
  const [checked, setChecked] = useState<Set<number>>(() => new Set());

  const [modal, setModal] = useState<'add' | 'import' | null>(null);
  const [confirm, setConfirm] = useState<'delOne' | 'delBulk' | null>(null);

  useEffect(() => {
    if (searchParams.get('nuevaEmpresa') === '1') {
      setModal('add');
    }
  }, [searchParams]);

  useEffect(() => {
    const prev = prevModalRef.current;
    if (prev === 'add' && modal === null && searchParams.get('nuevaEmpresa') === '1') {
      router.replace('/launcher/kyc', { scroll: false });
    }
    prevModalRef.current = modal;
  }, [modal, searchParams, router]);
  const [importText, setImportText] = useState('');
  const [addName, setAddName] = useState('');
  const [addSector, setAddSector] = useState('');
  const [addIndustry, setAddIndustry] = useState<'' | UserIndustryValue>('');
  const [addCity, setAddCity] = useState('');
  const [addWebsite, setAddWebsite] = useState('');
  const [addRevenue, setAddRevenue] = useState('');
  const [addEmployees, setAddEmployees] = useState('');
  const [addNotes, setAddNotes] = useState('');
  const [addStrategic, setAddStrategic] = useState(false);

  const [profileFocus, setProfileFocus] = useState<KycProfileFocus | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [refreshIntelBusy, setRefreshIntelBusy] = useState(false);
  const msgAreaRef = useRef<HTMLDivElement | null>(null);

  const consumeProfileFocus = useCallback(() => setProfileFocus(null), []);

  const loadMessages = useCallback(async (sid: number) => {
    const m = await kycJson<ChatMsg[]>(`/api/kyc/chat/sessions/${sid}/messages`);
    setMsgs(Array.isArray(m) ? m : []);
  }, []);

  const loadSessions = useCallback(
    async (companyId: number, preferredId?: number | null) => {
      const s = await kycJson<SessionRow[]>(`/api/kyc/companies/${companyId}/chat/sessions`);
      setSessions(s);
      const pick = preferredId != null && s.some((x) => x.id === preferredId) ? preferredId : s[0]?.id;
      if (pick != null) {
        setSessionId(pick);
        await loadMessages(pick);
      } else {
        setSessionId(null);
        setMsgs([]);
      }
    },
    [loadMessages],
  );

  const loadCompanies = useCallback(async () => {
    setLoadingList(true);
    setListErr(null);
    const q = new URLSearchParams();
    if (search.trim()) q.set('q', search.trim());
    if (strategicOnly) q.set('strategic', 'true');
    try {
      const rows = await kycJson<CompanyRow[]>(`/api/kyc/companies?${q.toString()}`);
      setCompanies(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setListErr((e as Error).message);
      setCompanies([]);
    } finally {
      setLoadingList(false);
    }
  }, [search, strategicOnly]);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadCompanies();
    }, 250);
    return () => clearTimeout(t);
  }, [loadCompanies]);

  useEffect(() => {
    try {
      window.localStorage.setItem('kyc_tab', tab);
    } catch {
      /* empty */
    }
  }, [tab]);

  useEffect(() => {
    const el = msgAreaRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [msgs, chatBusy]);

  const activeChatSession = useMemo(() => sessions.find((s) => s.id === sessionId), [sessions, sessionId]);

  const chatQuickActions = useMemo(
    () =>
      buildKycChatQuickActions({
        sessionType: activeChatSession?.session_type,
        openQuestionCount: detail?.open_questions?.length ?? 0,
        completeness: detail?.completeness ?? null,
      }),
    [activeChatSession?.session_type, detail?.open_questions?.length, detail?.completeness],
  );

  const selectCompany = useCallback(
    async (id: number) => {
      // Solo resetea el chat cuando cambiamos de empresa.
      if (selId !== id) {
        setSessionId(null);
        setMsgs([]);
      }
      setSelId(id);
      const n = companies.find((c) => c.id === id)?.name || String((detail?.company as { name?: unknown } | null)?.name ?? '');
      const slug = slugify(String(n));
      router.replace(`/launcher/kyc/${id}${slug ? '-' + slug : ''}`, { scroll: false });
      try {
        const d = await kycJson<Full>(`/api/kyc/companies/${id}`);
        for (const m of d.org?.members ?? []) {
          m.id = m.id != null ? Number(m.id) : m.id;
          m.reports_to_id = m.reports_to_id != null ? Number(m.reports_to_id) : null;
        }
        setDetail(d);
        const loadedName = String((d.company as { name?: unknown } | null)?.name ?? '');
        const loadedSlug = slugify(loadedName);
        if (chatOpen) void loadSessions(id);
      } catch {
        setDetail(null);
      }
    },
    [chatOpen, loadSessions, msgs.length, selId, sessionId, router],
  );

  useEffect(() => {
    if (!initialCompanyId) return;
    if (selId === initialCompanyId) return;
    void selectCompany(initialCompanyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCompanyId]);

  const refreshDetailOnly = useCallback(
    async (id: number) => {
      try {
        const d = await kycJson<Full>(`/api/kyc/companies/${id}`);
        for (const m of d.org?.members ?? []) {
          m.id = m.id != null ? Number(m.id) : m.id;
          m.reports_to_id = m.reports_to_id != null ? Number(m.reports_to_id) : null;
        }
        setDetail(d);
      } catch (e) {
        setBanner((e as Error).message);
      }
    },
    [chatOpen, msgs.length, selId, sessionId],
  );

  const refetchNow = useCallback(() => {
    if (selId) void refreshDetailOnly(selId);
  }, [selId, refreshDetailOnly]);

  const syncStrategicInCompanyList = useCallback(
    (companyId: number, strategic: boolean) => {
      setCompanies((prev) => {
        if (strategicOnly && !strategic) {
          return prev.filter((c) => c.id !== companyId);
        }
        return prev.map((c) => (c.id === companyId ? { ...c, strategic } : c));
      });
    },
    [strategicOnly],
  );

  const runStream = useCallback(
    async (companyId: number, sid: number, userMessage: string) => {
      setChatBusy(true);
      let acc = '';
      setMsgs((prev) => [...prev, { role: 'user', content: userMessage }, { role: 'assistant', content: '' }]);
      try {
        await kycStreamChat(sid, userMessage, (ev, data) => {
          if (ev === 'chunk' && data && typeof data === 'object' && 'text' in data) {
            acc += (data as { text: string }).text || '';
            setMsgs((prev) => {
              const c = [...prev];
              c[c.length - 1] = { role: 'assistant', content: acc };
              return c;
            });
          } else if (ev === 'error' && data && typeof data === 'object' && 'error' in data) {
            acc += '\n[error] ' + String((data as { error: string }).error);
            setMsgs((prev) => {
              const c = [...prev];
              c[c.length - 1] = { role: 'assistant', content: acc };
              return c;
            });
          }
        });
        void refreshDetailOnly(companyId);
      } catch (er) {
        setMsgs((prev) => {
          const c = [...prev];
          c[c.length - 1] = { role: 'assistant', content: 'Error: ' + (er as Error).message };
          return c;
        });
      } finally {
        setChatBusy(false);
      }
    },
    [refreshDetailOnly],
  );

  const sendUserMessage = useCallback(
    async (message: string) => {
      const trimmed = message.trim();
      if (!trimmed || chatBusy) return;
      if (!selId) {
        setBanner('Selecciona una empresa en la lista.');
        return;
      }
      setBanner(null);
      let sid = sessionId;
      if (!sid) {
        const s = await kycJson<{ id: number }>(`/api/kyc/companies/${selId}/chat/sessions`, {
          method: 'POST',
          body: JSON.stringify({ title: 'Sesión ' + new Date().toLocaleString() }),
        });
        sid = s.id;
        await loadSessions(selId, s.id);
      }
      if (!sid) return;
      void runStream(selId, sid, trimmed);
    },
    [chatBusy, selId, sessionId, loadSessions, runStream],
  );

  const startIntake = useCallback(
    async (targetId?: number) => {
      const id = targetId ?? selId;
      if (id == null) return;
      setBanner(null);
      if (id !== selId) {
        await selectCompany(id);
      }
      setChatOpen(true);
      try {
        const s = await kycJson<{ id: number }>(`/api/kyc/companies/${id}/chat/sessions`, {
          method: 'POST',
          body: JSON.stringify({ type: 'intake', title: 'Entrevista guiada · ' + new Date().toLocaleDateString() }),
        });
        await loadSessions(id, s.id);
        void runStream(id, s.id, '/iniciar');
      } catch (e) {
        setBanner('No se pudo iniciar la entrevista. ' + (e as Error).message);
      }
    },
    [selId, selectCompany, loadSessions, runStream],
  );

  const openChat = async () => {
    if (!selId) return;
    setChatOpen(true);
    await loadSessions(selId, sessionId);
  };

  const newSession = async () => {
    if (!selId) return;
    const s = await kycJson<{ id: number }>(`/api/kyc/companies/${selId}/chat/sessions`, {
      method: 'POST',
      body: JSON.stringify({ title: 'Sesión ' + new Date().toLocaleString() }),
    });
    await loadSessions(selId, s.id);
  };

  const sendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = chatInput.trim();
    if (!message || chatBusy) return;
    setChatInput('');
    await sendUserMessage(message);
  };

  const submitAdd = async () => {
    if (!addName.trim()) return;
    const r = await kycJson<{ id: number }>('/api/kyc/companies', {
      method: 'POST',
      body: JSON.stringify({
        name: addName.trim(),
        sector: addSector || undefined,
        industry: addIndustry || undefined,
        city: addCity || undefined,
        website: addWebsite || undefined,
        revenue: addRevenue || undefined,
        employees: addEmployees || undefined,
        notes: addNotes || undefined,
        strategic: addStrategic,
      }),
    });
    setModal(null);
    setAddName('');
    setAddSector('');
    setAddIndustry('');
    setAddCity('');
    setAddWebsite('');
    setAddRevenue('');
    setAddEmployees('');
    setAddNotes('');
    setAddStrategic(false);
    await loadCompanies();
    setSelId(r.id);
    void selectCompany(r.id);
  };

  const submitImport = async () => {
    const lines = importText.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return;
    const first = lines[0]!;
    const sep = first.includes('\t') ? '\t' : first.includes(';') ? ';' : ',';
    const headers = first.split(sep).map((h) => h.trim().toLowerCase());
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i]!.split(sep);
      const row: Record<string, string> = {};
      headers.forEach((h, j) => {
        row[h] = (parts[j] || '').trim();
      });
      const n = row.name || row.empresa || row.nombre;
      if (n) {
        row.name = n;
        rows.push(row);
      }
    }
    await kycJson('/api/kyc/companies/import', { method: 'POST', body: JSON.stringify({ companies: rows }) });
    setModal(null);
    setImportText('');
    void loadCompanies();
  };

  const onBulkDelete = () => {
    if (!checked.size) return;
    setConfirm('delBulk');
  };

  const onConfirmBulk = async () => {
    const ids = Array.from(checked);
    setConfirm(null);
    await kycJson('/api/kyc/companies/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) });
    setChecked(new Set());
    if (selId && ids.includes(selId)) {
      setSelId(null);
      setDetail(null);
    }
    void loadCompanies();
  };

  const detailCo = detail?.company as
    | { id?: number; name?: string; sector?: string | null; city?: string | null }
    | undefined;
  const companyName = String(detailCo?.name ?? '—');
  const memberCount =
    detail?.org?.members?.length != null ? filterKycOrgChartMembers(detail.org.members).length : 0;
  const signalCount = detail?.signals?.length ?? 0;
  const openQCount = detail?.open_questions?.length ?? 0;

  return (
    <div className={className ? `${styles.root} ${className}` : styles.root}>
      {banner && <div className={styles.banner}>{banner}</div>}
      <div className={styles.command}>
        <h1>KYC</h1>
        <div className={styles.row}>
          <input
            className={styles.search}
            placeholder="Buscar empresa…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar"
          />
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
            onClick={() => setStrategicOnly((s) => !s)}
          >
            {strategicOnly ? 'Solo ★ estratégicas' : 'Todas'}
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} onClick={() => setModal('add')}>
            + Empresa
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`} onClick={() => setModal('import')}>
            Importar
          </button>
          {checked.size > 0 && (
            <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.danger}`} onClick={onBulkDelete}>
              Eliminar ({checked.size})
            </button>
          )}
          <button type="button" className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`} onClick={openChat}>
            Chat KYC
          </button>
        </div>
      </div>
      <div className={styles.body}>
        <aside className={styles.aside} aria-label="Lista de empresas KYC">
          <div className={styles.asideHeader}>
            <div className={styles.listCount}>
              {listErr ? (
                <span className={styles.listCountErr} title={listErr}>
                  Error al cargar
                </span>
              ) : loadingList ? (
                'Cargando…'
              ) : (
                <>
                  <span className={styles.listCountN}>{companies.length}</span>
                  <span className={styles.listCountLabel}>{companies.length === 1 ? 'empresa' : 'empresas'}</span>
                </>
              )}
            </div>
          </div>
          <div className={styles.asideListWrap}>
            <div className={styles.list}>
              {companies.map((c) => (
                <div
                  key={c.id}
                  className={`${styles.listItemRow} ${selId === c.id ? styles.listItemRowActive : ''}`}
                >
                  <input
                    type="checkbox"
                    className={styles.listRowCbx}
                    checked={checked.has(c.id)}
                    aria-label={`Seleccionar ${c.name} para eliminar en bloque`}
                    onChange={() => {
                      setChecked((prev) => {
                        const n = new Set(prev);
                        if (n.has(c.id)) n.delete(c.id);
                        else n.add(c.id);
                        return n;
                      });
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    type="button"
                    className={styles.listRowSelect}
                    onClick={() => void selectCompany(c.id)}
                  >
                    <div className={styles.itemTitle}>
                      <span className={styles.itemTitleText}>{c.name}</span>
                      {c.strategic ? (
                        <span className={styles.chipStrategicList} title="Estratégica">
                          ★
                        </span>
                      ) : null}
                    </div>
                    <div className={styles.itemMeta}>
                      {[c.industry ? industryLabel(c.industry) : null, companyListMeta(c)]
                        .filter((x) => x != null && String(x).trim() !== '')
                        .join(' · ') || '—'}
                    </div>
                  </button>
                  <button
                    type="button"
                    className={styles.listRowIntake}
                    title="Iniciar entrevista guiada"
                    aria-label={`Iniciar entrevista guiada con ${c.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      void startIntake(c.id);
                    }}
                  >
                    Entrevista
                  </button>
                </div>
              ))}
              {!companies.length && !loadingList && (
                <div className={styles.listEmpty}>No hay empresas. Usa «+ Empresa» o «Importar» arriba.</div>
              )}
            </div>
          </div>
        </aside>
        <main className={styles.main}>
          {!detail && (
            <div className={styles.empty}>
              <div className={styles.emptyCard}>
                <div className={`${styles.emptyIcon} sap-icon sap-icon--launchpad`} aria-hidden />
                <h2 className={styles.emptyTitle}>Selecciona una empresa</h2>
                <p className={styles.emptyText}>
                  Elige una empresa en la lista de la izquierda para ver su perfil KYC, stack tecnológico, señales y pendientes.
                </p>
                <div className={styles.emptyActions}>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    onClick={() => setModal('add')}
                  >
                    + Empresa
                  </button>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    onClick={() => setModal('import')}
                  >
                    Importar
                  </button>
                </div>
              </div>
            </div>
          )}
          {detail && (
            <>
              <div className={styles.card}>
                <div className={styles.row} style={{ justifyContent: 'space-between' }}>
                  <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{escapeHtml(companyName)}</h2>
                  <div className={styles.row}>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                      onClick={() => {
                        if (selId) window.open(`/kyc/report.html?id=${selId}&print=1`, '_blank');
                      }}
                    >
                      Informe PDF
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                      disabled={refreshIntelBusy}
                      title="Revisa el perfil completo: actualiza señales (noticias) y re-genera el resumen ejecutivo con IA (si tienes clave configurada)."
                      onClick={async () => {
                        if (!selId) return;
                        setBanner(null);
                        setRefreshIntelBusy(true);
                        try {
                          const r = await kycJson<{ ok?: boolean; news?: { created: number; total: number }; summary?: { ok: boolean }; warning?: string }>(
                            `/api/kyc/companies/${selId}/enrich`,
                            { method: 'POST' },
                          );
                          const created = Number(r?.news?.created ?? 0);
                          const total = Number(r?.news?.total ?? 0);
                          const summaryOk = r?.summary?.ok === true;
                          const parts = [
                            `Noticias: ${created} nueva${created === 1 ? '' : 's'} (${total} en el RSS)`,
                            summaryOk ? 'Resumen ejecutivo: actualizado' : 'Resumen ejecutivo: sin cambios',
                          ];
                          setBanner(`${parts.join(' · ')}. Datos del cliente recargados.${r?.warning ? ` ${r.warning}` : ''}`);
                          void selectCompany(selId);
                          void loadCompanies();
                        } catch (er) {
                          setBanner('No se pudieron actualizar las noticias. ' + (er as Error).message);
                        } finally {
                          setRefreshIntelBusy(false);
                        }
                      }}
                    >
                      {refreshIntelBusy ? 'Actualizando…' : 'Actualizar'}
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                      onClick={() => {
                        if (selId) void startIntake(selId);
                      }}
                    >
                      Entrevista guiada
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnSm} ${styles.danger}`}
                      onClick={() => setConfirm('delOne')}
                    >
                      Eliminar KYC
                    </button>
                  </div>
                </div>
                {detail.profile == null && selId && (
                  <p>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}
                      onClick={async () => {
                        if (!selId) return;
                        await kycJson(`/api/kyc/companies/${selId}/activate`, { method: 'POST' });
                        void selectCompany(selId);
                      }}
                    >
                      Activar KYC
                    </button>
                  </p>
                )}
              </div>
              <div className={styles.tabs}>
                {TABS.map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`${styles.tab} ${tab === id ? styles.tabActive : ''}`}
                    onClick={() => setTab(id)}
                  >
                    {label}
                    {id === 'por_resolver' && openQCount > 0 ? ` (${openQCount})` : ''}
                  </button>
                ))}
              </div>
              {tab === 'dashboard' && (
                <KycProfileDashboard
                  companyId={selId!}
                  profile={detail.profile}
                  company={detail.company}
                  completeness={detail.completeness}
                  memberCount={memberCount}
                  signalCount={signalCount}
                  openQCount={openQCount}
                  onRefetch={refetchNow}
                  onStrategicChange={syncStrategicInCompanyList}
                  onBanner={setBanner}
                  onIntake={() => {
                    if (selId) void startIntake(selId);
                  }}
                  focusRequest={profileFocus}
                  onFocusConsumed={consumeProfileFocus}
                />
              )}
              {tab === 'organigrama' && selId && (
                <KycOrgPanel
                  companyId={selId}
                  members={detail.org.members}
                  rels={detail.org.relationships}
                  onRefetch={refetchNow}
                  onBanner={setBanner}
                />
              )}
              {tab === 'stack' && (
                <KycStackView
                  techStack={(((detail.profile as Record<string, unknown> | null) || {})?.tech_stack as object) ?? {}}
                  onGotoDashboard={() => setTab('dashboard')}
                />
              )}
              {tab === 'por_resolver' && selId && (
                <KycPorResolverPanel
                  companyId={selId}
                  questions={detail.open_questions}
                  profile={(detail.profile as Record<string, unknown> | null) ?? null}
                  orgMemberCount={memberCount}
                  onRefetch={refetchNow}
                  onBanner={setBanner}
                  onGoProfile={(f) => {
                    setTab('dashboard');
                    setProfileFocus(f);
                  }}
                  onGoOrganigrama={() => setTab('organigrama')}
                />
              )}
              {tab === 'signals' && selId && (
                <KycSignalsPanel
                  companyId={selId}
                  signals={detail.signals as { id: number; source: string; source_url: string | null; title: string | null; text: string | null; sentiment: string | null; published_at: string | null }[]}
                  onRefetch={refetchNow}
                  onBanner={setBanner}
                />
              )}
            </>
          )}
        </main>
        {chatOpen && (
          <aside className={`${styles.chat} ${styles.chatOpen}`} aria-label="Chat KYC">
            <div className={styles.chatHead}>
              <div className={styles.chatHeadText}>
                <div className={styles.chatHeadTitle}>Asistente KYC</div>
                <div className={styles.chatHeadSub}>
                  {(activeChatSession?.session_type || '').toLowerCase() === 'intake'
                    ? 'Entrevista guiada'
                    : 'Investigación'}
                  {companyName ? ` · ${companyName}` : ''}
                </div>
              </div>
            </div>
            <div className={styles.sessions}>
              {sessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`${styles.sessBtn} ${sessionId === s.id ? styles.sessBtnActive : ''}`}
                  onClick={() => {
                    setSessionId(s.id);
                    void loadMessages(s.id);
                  }}
                >
                  {s.title || `#${s.id}`}
                </button>
              ))}
              <button type="button" className={styles.sessBtn} onClick={newSession} disabled={chatBusy}>
                Nueva
              </button>
              <button
                type="button"
                className={styles.sessBtn}
                onClick={() => {
                  setChatOpen(false);
                  if (selId) {
                    void selectCompany(selId);
                    void loadCompanies();
                  }
                }}
              >
                Cerrar
              </button>
            </div>
            <div ref={msgAreaRef} className={styles.msgArea}>
              {msgs.length === 0 ? (
                <p className={styles.chatEmpty}>Escribe un mensaje o elige una sugerencia abajo.</p>
              ) : null}
              {msgs.map((m, i) => {
                const isLast = i === msgs.length - 1;
                const showTyping = m.role === 'assistant' && chatBusy && isLast && m.content === '';
                if (m.role === 'user') {
                  return (
                    <div key={i} className={styles.msgUser}>
                      {stripKycProposedJsonFromChatText(m.content)}
                    </div>
                  );
                }
                if (showTyping) {
                  return (
                    <div key={i} className={`${styles.msgAi} ${styles.msgAiTyping}`} role="status" aria-live="polite">
                      <span className={styles.chatTypingDots} aria-hidden>
                        <span />
                        <span />
                        <span />
                      </span>
                      <span className={styles.srOnly}>El asistente está escribiendo</span>
                    </div>
                  );
                }
                return (
                  <div
                    key={i}
                    className={`${styles.msgAi} ${styles.msgAiRich}`}
                    dangerouslySetInnerHTML={{
                      __html: formatKycAssistantMessageHtml(m.content) || '\u00A0',
                    }}
                  />
                );
              })}
            </div>
            <div className={styles.chatQuickWrap}>
              <span className={styles.chatQuickLabel}>Siguiente acción</span>
              <div className={styles.chatQuickRow}>
                {chatQuickActions.map((a) => (
                  <button
                    key={`${a.label}:${a.message.slice(0, 48)}`}
                    type="button"
                    className={styles.chatQuickChip}
                    disabled={chatBusy || !selId}
                    title={a.message}
                    onClick={() => void sendUserMessage(a.message)}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
            <form className={styles.chatForm} onSubmit={sendChat}>
              <textarea
                className={styles.chatTextareaChat}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    (e.currentTarget as HTMLTextAreaElement).form?.requestSubmit();
                  }
                }}
                rows={2}
                placeholder="Escribe aquí… (Mayús+Intro para salto de línea)"
                disabled={chatBusy}
                aria-busy={chatBusy}
              />
              <button
                type="submit"
                className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm} ${styles.chatSendBtn}`}
                disabled={chatBusy || !chatInput.trim()}
              >
                {chatBusy ? '…' : 'Enviar'}
              </button>
            </form>
          </aside>
        )}
      </div>
      {modal === 'add' && (
        <div className={styles.modalOverlay} onClick={() => setModal(null)} role="presentation">
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>Añadir cliente</h2>
            <div className={styles.formRow}>
              <label className={styles.label}>Nombre empresa *</label>
              <input className={styles.input} value={addName} onChange={(e) => setAddName(e.target.value)} />
            </div>
            <div className={styles.row} style={{ gap: '0.75rem' }}>
              <div className={styles.formRow} style={{ flex: 1, minWidth: '12rem' }}>
                <label className={styles.label}>Sector</label>
                <input className={styles.input} value={addSector} onChange={(e) => setAddSector(e.target.value)} />
              </div>
              <div className={styles.formRow} style={{ flex: 1, minWidth: '12rem' }}>
                <label className={styles.label} htmlFor="kyc-add-industry">
                  Industria
                </label>
                <select
                  id="kyc-add-industry"
                  className={styles.input}
                  aria-label="Industria"
                  value={addIndustry}
                  onChange={(e) => setAddIndustry((e.target.value === '' ? '' : e.target.value) as '' | UserIndustryValue)}
                >
                  <option value="">Seleccionar…</option>
                  {USER_INDUSTRY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formRow} style={{ flex: 1, minWidth: '12rem' }}>
                <label className={styles.label}>Ciudad</label>
                <input className={styles.input} value={addCity} onChange={(e) => setAddCity(e.target.value)} />
              </div>
            </div>
            <div className={styles.formRow}>
              <label className={styles.label}>Website (ej: acme.com)</label>
              <input className={styles.input} value={addWebsite} onChange={(e) => setAddWebsite(e.target.value)} />
            </div>
            <div className={styles.row} style={{ gap: '0.75rem' }}>
              <div className={styles.formRow} style={{ flex: 1, minWidth: '12rem' }}>
                <label className={styles.label}>Facturación</label>
                <input className={styles.input} value={addRevenue} onChange={(e) => setAddRevenue(e.target.value)} />
              </div>
              <div className={styles.formRow} style={{ flex: 1, minWidth: '12rem' }}>
                <label className={styles.label}>Empleados</label>
                <input className={styles.input} value={addEmployees} onChange={(e) => setAddEmployees(e.target.value)} />
              </div>
            </div>
            <div className={styles.formRow}>
              <label className={styles.label}>Notas</label>
              <textarea className={styles.textareaLg} value={addNotes} onChange={(e) => setAddNotes(e.target.value)} />
            </div>
            <label className={styles.row} style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={addStrategic} onChange={(e) => setAddStrategic(e.target.checked)} /> Estratégica
            </label>
            <div className={styles.modalActions}>
              <button type="button" className={styles.btn} onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={submitAdd}>
                Añadir
              </button>
            </div>
          </div>
        </div>
      )}
      {modal === 'import' && (
        <div className={styles.modalOverlay} onClick={() => setModal(null)} role="presentation">
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>Importar</h2>
            <p className={styles.hint}>TSV/CSV con cabecera. Columna name obligatoria.</p>
            <textarea
              className={styles.textareaLg}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              style={{ minHeight: '8rem' }}
            />
            <div className={styles.modalActions}>
              <button type="button" className={styles.btn} onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={submitImport}>
                Importar
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={!!confirm}
        title={confirm === 'delBulk' ? 'Eliminar selección' : 'Confirmar eliminación'}
        message="Esta acción quita el perfil KYC. ¿Continuar?"
        variant="danger"
        confirmVariant="danger"
        confirmLabel="Eliminar"
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (confirm === 'delBulk') {
            await onConfirmBulk();
            return;
          }
          if (confirm === 'delOne' && selId) {
            setConfirm(null);
            await kycJson(`/api/kyc/companies/${selId}`, { method: 'DELETE' });
            setSelId(null);
            setDetail(null);
            void loadCompanies();
            return;
          }
          setConfirm(null);
        }}
      />
    </div>
  );
}
