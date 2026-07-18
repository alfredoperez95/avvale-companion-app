'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useKycSearchParams } from './KycUrlParamsContext';
import { CssStyled } from '@/components/CssStyled/CssStyled';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { kycJson, kycStreamChat } from './kycApi';
import { buildKycChatQuickActions } from './kycChatQuickActions';
import { formatKycAssistantMessageHtml, stripKycProposedJsonFromChatText } from './kycChatMessageFormat';
import { filterKycOrgChartMembers } from './kycOrgChartFilter';
import { KycOrgPanel } from './KycOrgPanel';
import { KycPorResolverPanel } from './KycPorResolverPanel';
import { KycAvvalePanel } from './KycAvvalePanel';
import { KycAvvaleProjectsPanel } from './KycAvvaleProjectsPanel';
import { KycProfileDashboard, type KycProfileFocus } from './KycProfileDashboard';
import { KycRfqsPanel } from './KycRfqsPanel';
import { KycSignalsPanel } from './KycSignalsPanel';
import { KycStackView } from './KycStackView';
import { USER_INDUSTRY_OPTIONS, industryLabel, type UserIndustryValue } from '@/lib/user-industry';
import { faviconApexFallbackFromWebsite, faviconUrlFromWebsite } from './kycFaviconUrl';
import {
  KycIconChatSm,
  KycIconFilterSm,
  KycIconListSm,
  KycIconSearchSm,
  KycPlusIcon,
  KycStrategicStarIcon,
  KycToolbarInterviewIcon,
  KycToolbarMoreIcon,
  KycToolbarPdfIcon,
  KycToolbarRefreshIcon,
  KycToolbarTrashIcon,
} from './KycMiniIcons';
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
  ['avvale_projects', 'Proyectos'],
  ['avvale', 'Avvale'],
  ['organigrama', 'Organigrama'],
  ['stack', 'Tecnología'],
  ['por_resolver', 'Por resolver'],
  ['rfqs', 'RFQs'],
  ['signals', 'Señales'],
] as const;

type KycTabId = (typeof TABS)[number][0];
const TAB_IDS_ORDER = TABS.map(([id]) => id) as KycTabId[];
const TAB_ID_SET = new Set<string>(TABS.map(([id]) => id));

function isKycTabId(s: string | null): s is KycTabId {
  return s != null && TAB_ID_SET.has(s);
}

/** Fusiona query sobre pathname (preserva otros params salvo los indicados en patch con null para borrar). */
function buildKycUrl(pathname: string, baseSearch: URLSearchParams, patch: Record<string, string | null | undefined>) {
  const p = new URLSearchParams(baseSearch.toString());
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (v === null || v === '') p.delete(k);
    else p.set(k, v);
  }
  const qs = p.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

type KycWorkspaceProps = { className?: string };

const KYC_CHAT_CLOSE_MS = 280;

function kycChatCloseDurationMs(): number {
  if (typeof window === 'undefined') return KYC_CHAT_CLOSE_MS;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : KYC_CHAT_CLOSE_MS;
}

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

/** El layout `kyc/layout.tsx` no recibe siempre `params.id` del segmento `[id]`; la URL sí. */
function parseKycCompanyIdFromPathname(pathname: string | null): number | null {
  if (!pathname) return null;
  const m = pathname.match(/^\/launcher\/kyc\/(\d+)(?:-[^/]*)?(?:\/|$)/);
  if (!m?.[1]) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * En móvil, desplaza solo la franja horizontal de pestañas para ver la activa.
 * No usa `scrollIntoView` sobre el panel (evita saltos de viewport tipo ancla).
 */
function scrollKycTabButtonIntoTabsStripMobile(strip: HTMLDivElement | null, tabId: KycTabId) {
  if (typeof window === 'undefined' || !strip) return;
  if (!window.matchMedia('(max-width: 900px)').matches) return;
  requestAnimationFrame(() => {
    const btn = document.getElementById(`kyc-tab-${tabId}`);
    if (!btn) return;
    const stripRect = strip.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const pad = 8;
    let delta = 0;
    if (btnRect.left < stripRect.left + pad) {
      delta = btnRect.left - stripRect.left - pad;
    } else if (btnRect.right > stripRect.right - pad) {
      delta = btnRect.right - stripRect.right + pad;
    } else {
      return;
    }
    strip.scrollTo({ left: strip.scrollLeft + delta, behavior: 'smooth' });
  });
}

function sortCompaniesByName(list: CompanyRow[]): CompanyRow[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
}

function companyListMeta(c: { sector: string | null; city: string | null }) {
  const parts = [String(c.sector ?? '').trim(), String(c.city ?? '').trim()].filter((s) => s.length > 0);
  return parts.length > 0 ? parts.join(' · ') : 'Sin sector ni ciudad';
}

function companyInitialsForList(name: string) {
  return (name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/** Favicon de la web de la cuenta (misma fuente que el hero), con iniciales si falla. */
function KycCompanyListAvatar({ website, name }: { website: string | null; name: string }) {
  const [faviconFailed, setFaviconFailed] = useState(false);
  const [faviconUseApex, setFaviconUseApex] = useState(false);
  const faviconSrc = useMemo(() => faviconUrlFromWebsite(website), [website]);
  const faviconApexSrc = useMemo(() => faviconApexFallbackFromWebsite(website), [website]);
  useEffect(() => {
    setFaviconFailed(false);
    setFaviconUseApex(false);
  }, [faviconSrc, faviconApexSrc]);
  const imgSrc = faviconUseApex && faviconApexSrc ? faviconApexSrc : faviconSrc;
  const showImg = Boolean(imgSrc && !faviconFailed);
  return (
    <div
      className={`${styles.listRowAvatar} ${showImg ? styles.listRowAvatarWithIcon : ''}`}
      title={website?.trim() ? website : undefined}
      aria-hidden
    >
      {showImg ? (
        <img
          src={imgSrc!}
          alt=""
          className={styles.listRowAvatarImg}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => {
            setFaviconUseApex((prev) => {
              if (!prev && faviconApexSrc) return true;
              setFaviconFailed(true);
              return prev;
            });
          }}
        />
      ) : (
        companyInitialsForList(name)
      )}
    </div>
  );
}

export default function KycWorkspace({ className }: KycWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ id?: string }>();
  const searchParams = useKycSearchParams();

  const routeCompanyId = useMemo(() => {
    const fromPath = parseKycCompanyIdFromPathname(pathname);
    if (fromPath != null) return fromPath;
    const raw = params?.id != null ? String(params.id) : '';
    const id = Number(raw.split('-')[0]);
    return Number.isFinite(id) && id > 0 ? id : null;
  }, [pathname, params?.id]);
  const prevModalRef = useRef<'add' | null>(null);

  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [search, setSearch] = useState('');
  const [strategicOnly, setStrategicOnly] = useState(false);
  /** Filtro por industria de ficha (valores `UserIndustry` / `KycCompany.industry`). */
  const [listIndustry, setListIndustry] = useState('');
  /** Panel del filtro por industria (selector bajo icono en la cabecera del aside). */
  const [listIndustryFilterOpen, setListIndustryFilterOpen] = useState(false);
  const listIndustryFilterRef = useRef<HTMLDivElement | null>(null);
  const [listErr, setListErr] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  /** Entrada del bloque KYC (independiente de la carga del listado). */
  const [workspaceShellOn, setWorkspaceShellOn] = useState(false);
  const [selId, setSelId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Full | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const [tab, setTab] = useState<KycTabId>(() => {
    if (typeof window === 'undefined') return 'dashboard';
    const saved = window.localStorage.getItem('kyc_tab') || '';
    return isKycTabId(saved) ? saved : 'dashboard';
  });
  const [checked, setChecked] = useState<Set<number>>(() => new Set());

  const [modal, setModal] = useState<'add' | null>(null);
  const [confirm, setConfirm] = useState<'delOne' | 'delBulk' | null>(null);
  const [detailDangerMenuOpen, setDetailDangerMenuOpen] = useState(false);
  const detailDangerWrapRef = useRef<HTMLDivElement | null>(null);

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
  const [chatClosing, setChatClosing] = useState(false);
  const [chatPortalReady, setChatPortalReady] = useState(false);
  /** En cliente el id de `window.setTimeout` es number (Node @types usa Timeout). */
  const chatCloseTimerRef = useRef<number | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [refreshIntelBusy, setRefreshIntelBusy] = useState(false);
  const msgAreaRef = useRef<HTMLDivElement | null>(null);
  const listSearchRef = useRef<HTMLInputElement | null>(null);
  const kycTabsStripRef = useRef<HTMLDivElement | null>(null);
  const detailRef = useRef<Full | null>(null);
  detailRef.current = detail;
  const selIdRef = useRef<number | null>(null);
  selIdRef.current = selId;
  /** Evita aplicar `detail` o `detailLoading` de una petición anterior si el usuario cambia de empresa rápido. */
  const kycSelectGenerationRef = useRef(0);
  /** Mientras la URL aún no refleja la empresa elegida, el efecto URL→select no debe llamar `selectCompany(idViejo)`. */
  const kycPendingCompanyFromListRef = useRef<number | null>(null);

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

  const companiesLoadedRef = useRef(false);
  /** Incrementa al recibir empresas para relanzar la entrada en cascada del aside. */
  const [listAnimKey, setListAnimKey] = useState(0);
  /** Listado visible tras la entrada del bloque (cascada de filas). */
  const [listRevealOn, setListRevealOn] = useState(false);
  /** Cascada solo en la primera carga; al filtrar el listado aparece de golpe. */
  const [listCascadeOn, setListCascadeOn] = useState(false);
  const listRevealTimerRef = useRef<number | null>(null);

  const KYC_LIST_REVEAL_DELAY_MS = 140;
  const KYC_LIST_REVEAL_FAILSAFE_MS = 1100;
  const companiesFetchDebounceRef = useRef(true);

  const clearListRevealTimer = useCallback(() => {
    if (listRevealTimerRef.current != null) {
      window.clearTimeout(listRevealTimerRef.current);
      listRevealTimerRef.current = null;
    }
  }, []);

  const scheduleListReveal = useCallback(
    (delayMs: number, withCascade: boolean) => {
      clearListRevealTimer();
      setListRevealOn(false);
      setListCascadeOn(false);
      listRevealTimerRef.current = window.setTimeout(() => {
        setListRevealOn(true);
        setListCascadeOn(withCascade);
        listRevealTimerRef.current = null;
      }, delayMs);
    },
    [clearListRevealTimer],
  );

  const loadCompanies = useCallback(async () => {
    const showFullLoader = !companiesLoadedRef.current;
    if (showFullLoader) {
      clearListRevealTimer();
      setListRevealOn(false);
      setListCascadeOn(false);
      setLoadingList(true);
    }
    setListErr(null);
    const q = new URLSearchParams();
    if (search.trim()) q.set('q', search.trim());
    if (strategicOnly) q.set('strategic', 'true');
    if (listIndustry.trim()) q.set('industry', listIndustry.trim());
    try {
      const rows = await kycJson<CompanyRow[]>(`/api/kyc/companies?${q.toString()}`);
      setCompanies(sortCompaniesByName(Array.isArray(rows) ? rows : []));
      setListAnimKey((k) => k + 1);
      companiesLoadedRef.current = true;
    } catch (e) {
      setListErr((e as Error).message);
      setCompanies([]);
      setListAnimKey((k) => k + 1);
    } finally {
      if (showFullLoader) {
        setLoadingList(false);
        scheduleListReveal(KYC_LIST_REVEAL_DELAY_MS, true);
      } else {
        clearListRevealTimer();
        setListCascadeOn(false);
        setListRevealOn(true);
      }
    }
  }, [search, strategicOnly, listIndustry, clearListRevealTimer, scheduleListReveal]);

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => setWorkspaceShellOn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const debounceMs = companiesFetchDebounceRef.current ? 0 : 250;
    companiesFetchDebounceRef.current = false;
    const t = setTimeout(() => {
      void loadCompanies();
    }, debounceMs);
    return () => clearTimeout(t);
  }, [loadCompanies]);

  useLayoutEffect(() => {
    if (loadingList) {
      clearListRevealTimer();
      setListRevealOn(false);
      setListCascadeOn(false);
    }
  }, [loadingList, clearListRevealTimer]);

  useEffect(() => {
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion && !loadingList) {
      clearListRevealTimer();
      setListRevealOn(true);
      setListCascadeOn(false);
    }
  }, [loadingList, clearListRevealTimer]);

  /** Si el temporizador de reveal falla, forzar visibilidad del listado. */
  useEffect(() => {
    if (loadingList || listRevealOn) return;
    const t = window.setTimeout(() => {
      setListRevealOn(true);
      setListCascadeOn(false);
    }, KYC_LIST_REVEAL_FAILSAFE_MS);
    return () => window.clearTimeout(t);
  }, [loadingList, listRevealOn]);

  useEffect(() => () => clearListRevealTimer(), [clearListRevealTimer]);

  useEffect(() => {
    /** Mientras carga la ficha, `searchParams` puede seguir siendo el de la URL anterior y pisaría `tab` puesto por `selectCompany(..., { resetTab: true })`. */
    if (detailLoading) return;
    const t = searchParams.get('tab');
    if (isKycTabId(t)) {
      setTab(t);
      try {
        window.localStorage.setItem('kyc_tab', t);
      } catch {
        /* empty */
      }
    }
  }, [searchParams, detailLoading]);

  useEffect(() => {
    if (detail == null || detailLoading) return;
    scrollKycTabButtonIntoTabsStripMobile(kycTabsStripRef.current, tab);
  }, [tab, detail, detailLoading]);

  const commitTab = useCallback(
    (next: KycTabId) => {
      setTab(next);
      try {
        window.localStorage.setItem('kyc_tab', next);
      } catch {
        /* empty */
      }
      scrollKycTabButtonIntoTabsStripMobile(kycTabsStripRef.current, next);
      if (!pathname.startsWith('/launcher/kyc')) return;
      router.replace(buildKycUrl(pathname, searchParams, { tab: next }), { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const commitChatOpen = useCallback(
    (open: boolean) => {
      if (open) setChatClosing(false);
      setChatOpen(open);
      if (!pathname.startsWith('/launcher/kyc')) return;
      router.replace(buildKycUrl(pathname, searchParams, { chat: open ? '1' : null }), { scroll: false });
    },
    [pathname, router, searchParams],
  );


  useEffect(() => {
    if (searchParams.get('chat') !== '1') return;
    if (!selId || detailLoading) return;
    setChatOpen(true);
    void loadSessions(selId);
  }, [searchParams, selId, detailLoading, loadSessions]);

  useEffect(() => {
    if (!mobileListOpen) return;
    document.body.dataset.kycDrawerOpen = '1';
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => listSearchRef.current?.focus());
    return () => {
      delete document.body.dataset.kycDrawerOpen;
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileListOpen]);

  useEffect(() => {
    const prevTitle = typeof document !== 'undefined' ? document.title : '';
    if (detail?.company) {
      const n = String((detail.company as { name?: unknown }).name ?? '').trim();
      document.title = n ? `${n} · KYC · Companion` : 'KYC · Companion';
    } else {
      document.title = 'KYC · Companion';
    }
    return () => {
      document.title = prevTitle;
    };
  }, [detail]);

  useEffect(() => {
    if (!mobileListOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileListOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileListOpen]);

  useEffect(() => {
    setDetailDangerMenuOpen(false);
  }, [selId]);

  useEffect(() => {
    if (!detailDangerMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const el = detailDangerWrapRef.current;
      if (el && !el.contains(e.target as Node)) setDetailDangerMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailDangerMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [detailDangerMenuOpen]);

  useEffect(() => {
    if (!listIndustryFilterOpen) return;
    const onDoc = (e: MouseEvent) => {
      const el = listIndustryFilterRef.current;
      if (el && !el.contains(e.target as Node)) setListIndustryFilterOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setListIndustryFilterOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [listIndustryFilterOpen]);

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
    async (id: number, opts?: { resetTab?: boolean }) => {
      const generation = ++kycSelectGenerationRef.current;
      if (opts?.resetTab) {
        kycPendingCompanyFromListRef.current = id;
      }
      setMobileListOpen(false);
      const tabFromQuery = searchParams.get('tab');
      const tabForUrl: KycTabId = opts?.resetTab
        ? 'dashboard'
        : isKycTabId(tabFromQuery)
          ? tabFromQuery
          : tab;
      if (opts?.resetTab) {
        setTab('dashboard');
        try {
          window.localStorage.setItem('kyc_tab', 'dashboard');
        } catch {
          /* empty */
        }
      }
      setSelId((prev) => {
        if (prev !== id) {
          setSessionId(null);
          setMsgs([]);
          setDetail(null);
        }
        return id;
      });
      setDetailLoading(true);
      setBanner(null);
      const n =
        companies.find((c) => c.id === id)?.name ||
        String((detailRef.current?.company as { name?: unknown } | null)?.name ?? '');
      const slug = slugify(String(n));
      const path = `/launcher/kyc/${id}${slug ? '-' + slug : ''}`;
      router.replace(
        buildKycUrl(path, searchParams, { nuevaEmpresa: null, tab: tabForUrl }),
        { scroll: false },
      );
      try {
        const d = await kycJson<Full>(`/api/kyc/companies/${id}`);
        if (generation !== kycSelectGenerationRef.current) return;
        for (const m of d.org?.members ?? []) {
          m.id = m.id != null ? Number(m.id) : m.id;
          m.reports_to_id = m.reports_to_id != null ? Number(m.reports_to_id) : null;
        }
        setDetail(d);
        if (chatOpen || searchParams.get('chat') === '1') void loadSessions(id);
      } catch {
        if (generation !== kycSelectGenerationRef.current) return;
        setDetail(null);
        setSelId(null);
        setBanner('No se encontró la empresa o no tienes acceso.');
        router.replace('/launcher/kyc', { scroll: false });
      } finally {
        if (generation === kycSelectGenerationRef.current) {
          setDetailLoading(false);
        }
      }
    },
    [chatOpen, companies, loadSessions, router, searchParams, tab],
  );

  useEffect(() => {
    const idLive =
      typeof window !== 'undefined'
        ? parseKycCompanyIdFromPathname(window.location.pathname)
        : null;
    const resolved = idLive ?? routeCompanyId;
    const pending = kycPendingCompanyFromListRef.current;
    const sel = selIdRef.current;
    const skipStaleUrl =
      pending != null && sel === pending && resolved != null && resolved !== pending;
    if (resolved == null) return;
    if (sel === resolved) return;
    if (skipStaleUrl) return;
    void selectCompany(resolved);
  }, [routeCompanyId, pathname, selectCompany]);

  useEffect(() => {
    const rid = parseKycCompanyIdFromPathname(pathname);
    if (rid != null && kycPendingCompanyFromListRef.current === rid) {
      kycPendingCompanyFromListRef.current = null;
    }
  }, [pathname]);

  useEffect(() => {
    const idLive =
      typeof window !== 'undefined'
        ? parseKycCompanyIdFromPathname(window.location.pathname)
        : null;
    /** Barra de direcciones puede ir un tick por delante de `usePathname` / `useParams` en el layout. */
    if (idLive != null) return;
    if (routeCompanyId != null) return;
    if (pathname !== '/launcher/kyc') return;
    /**
     * Tras elegir empresa, `router.replace` puede aplicarse un tick después de `setSelId` /
     * `setDetailLoading(true)`. En ese fotograma `routeCompanyId` sigue null y este efecto
     * no debe vaciar la selección (evidencia: clear con selId y detailLoading true).
     */
    if (detailLoading) return;
    const needsClear =
      selId != null || detail != null || chatOpen || sessionId != null || msgs.length > 0;
    if (!needsClear) return;
    commitChatOpen(false);
    setSelId(null);
    setDetail(null);
    setBanner(null);
    setDetailLoading(false);
    setSessionId(null);
    setMsgs([]);
  }, [
    routeCompanyId,
    pathname,
    selId,
    detail,
    chatOpen,
    sessionId,
    msgs.length,
    detailLoading,
    commitChatOpen,
  ]);

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
    [setBanner],
  );

  const refetchNow = useCallback(() => {
    if (selId) void refreshDetailOnly(selId);
  }, [selId, refreshDetailOnly]);

  const finishCloseChat = useCallback(() => {
    commitChatOpen(false);
    if (selId) {
      void refreshDetailOnly(selId);
      void loadCompanies();
    }
  }, [commitChatOpen, selId, refreshDetailOnly, loadCompanies]);

  const requestCloseChat = useCallback(() => {
    if (chatClosing || !chatOpen) return;
    setChatClosing(true);
  }, [chatClosing, chatOpen]);

  useEffect(() => {
    setChatPortalReady(true);
  }, []);

  useEffect(() => {
    if (!chatClosing) return;
    const duration = kycChatCloseDurationMs();
    chatCloseTimerRef.current = window.setTimeout(() => {
      chatCloseTimerRef.current = null;
      setChatClosing(false);
      finishCloseChat();
    }, duration);
    return () => {
      if (chatCloseTimerRef.current) {
        clearTimeout(chatCloseTimerRef.current);
        chatCloseTimerRef.current = null;
      }
    };
  }, [chatClosing, finishCloseChat]);

  useEffect(() => {
    if (!chatOpen && !chatClosing) {
      delete document.body.dataset.kycChatOpen;
      return;
    }
    document.body.dataset.kycChatOpen = '';
    return () => {
      if (!chatCloseTimerRef.current) {
        delete document.body.dataset.kycChatOpen;
      }
    };
  }, [chatOpen, chatClosing]);

  /** Flechas ←/→ cambian pestaña sin necesitar foco en el tablist (salvo inputs, chat, modales). Home/End solo con foco en una pestaña (tabIndex 0). */
  useEffect(() => {
    const isTypingTarget = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'OPTION') return true;
      if (el.isContentEditable) return true;
      return false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!pathname.startsWith('/launcher/kyc')) return;
      if (modal != null || confirm != null) return;

      if (e.key === 'Escape' && chatOpen && !chatClosing) {
        e.preventDefault();
        requestCloseChat();
        return;
      }

      if (!selId || !detail || detailLoading) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const tgt = e.target as Element | null;
      if (tgt?.closest?.('[role="alertdialog"]')) return;
      if (isTypingTarget(e.target)) return;
      if (chatOpen && tgt?.closest?.('[aria-label="Chat KYC"]')) return;

      const ids = TAB_IDS_ORDER;
      const idx = ids.indexOf(tab);
      if (idx < 0) return;

      let nextIdx: number | null = null;
      if (e.key === 'ArrowRight') nextIdx = (idx + 1) % ids.length;
      else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + ids.length) % ids.length;
      else if (e.key === 'Home' && tgt?.getAttribute?.('role') === 'tab') nextIdx = 0;
      else if (e.key === 'End' && tgt?.getAttribute?.('role') === 'tab') nextIdx = ids.length - 1;
      else return;

      if (nextIdx === null || nextIdx === idx) return;
      e.preventDefault();
      const nextId = ids[nextIdx];
      commitTab(nextId);
      window.setTimeout(() => {
        document.getElementById(`kyc-tab-${nextId}`)?.focus();
      }, 0);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pathname, selId, detail, detailLoading, modal, confirm, chatOpen, chatClosing, tab, commitTab, requestCloseChat]);


  const syncStrategicInCompanyList = useCallback(
    (companyId: number, strategic: boolean) => {
      setCompanies((prev) => {
        if (strategicOnly && !strategic) {
          return sortCompaniesByName(prev.filter((c) => c.id !== companyId));
        }
        return sortCompaniesByName(
          prev.map((c) => (c.id === companyId ? { ...c, strategic } : c)),
        );
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
      commitChatOpen(true);
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
    [selId, selectCompany, loadSessions, runStream, commitChatOpen],
  );

  const openChat = async () => {
    if (!selId) return;
    commitChatOpen(true);
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
    void selectCompany(r.id, { resetTab: true });
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

  const showChatPanel = chatOpen || chatClosing;
  const chatPanel = showChatPanel ? (
    <>
      <button
        type="button"
        className={chatClosing ? `${styles.chatScrim} ${styles.chatScrimLeaving}` : styles.chatScrim}
        onClick={requestCloseChat}
        aria-label="Cerrar chat"
        disabled={chatClosing}
      />
      <aside
        className={chatClosing ? `${styles.chatDrawer} ${styles.chatDrawerLeaving}` : styles.chatDrawer}
        role="dialog"
        aria-modal="true"
        aria-label="Chat KYC"
      >
        <header className={styles.chatHead}>
          <div className={styles.chatHeadText}>
            <div className={styles.chatHeadTitle}>Asistente KYC</div>
            <div className={styles.chatHeadSub}>
              {(activeChatSession?.session_type || '').toLowerCase() === 'intake'
                ? 'Entrevista guiada'
                : 'Investigación'}
              {companyName ? ` · ${companyName}` : ''}
            </div>
          </div>
          <button
            type="button"
            className={styles.chatClose}
            onClick={requestCloseChat}
            aria-label="Cerrar"
            disabled={chatClosing}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </header>
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
          <button type="button" className={styles.sessBtn} onClick={requestCloseChat} disabled={chatClosing}>
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
    </>
  ) : null;

  return (
    <div
      className={[styles.root, className].filter(Boolean).join(' ')}
      data-kyc-loading={workspaceShellOn ? undefined : 'true'}
    >
      {banner && <div className={styles.banner}>{banner}</div>}
      <div className={styles.command}>
        <div className={styles.commandHead}>
          <div className={styles.commandBrand}>
            <h1 className={styles.commandTitle}>KYC</h1>
          </div>
          <button
            type="button"
            className={`${styles.commandDrawerBtn} ${styles.kycMobileOpenListBtn}`}
            aria-expanded={mobileListOpen}
            aria-controls="kyc-company-list"
            title="Lista de empresas"
            aria-label="Abrir o cerrar la lista de empresas"
            onClick={() => setMobileListOpen((o) => !o)}
          >
            <KycIconListSm size={16} />
          </button>
        </div>
        <div className={styles.commandBody}>
          <label className={styles.commandSearchWrap} htmlFor="kyc-command-search">
            <span className={styles.commandSearchIcon} aria-hidden>
              <KycIconSearchSm />
            </span>
            <input
              id="kyc-command-search"
              ref={listSearchRef}
              className={styles.search}
              placeholder="Buscar empresa por nombre…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar empresa por nombre"
              autoComplete="off"
            />
          </label>
          <div className={styles.commandRail} role="toolbar" aria-label="Acciones del listado KYC">
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm} ${styles.commandBarBtn} ${styles.commandRailBtn}${strategicOnly ? ` ${styles.commandBarBtnPressed}` : ''}`}
              aria-pressed={strategicOnly}
              aria-label={
                strategicOnly ? 'Mostrar todas las empresas (quitar filtro estratégicas)' : 'Filtrar solo cuentas estratégicas'
              }
              title={strategicOnly ? 'Mostrar todas' : 'Solo cuentas marcadas como estratégicas'}
              onClick={() => setStrategicOnly((s) => !s)}
            >
              <span className={styles.commandBarBtnIcon} aria-hidden>
                <KycStrategicStarIcon filled={strategicOnly} size={14} />
              </span>
              {strategicOnly ? 'Estratégicas' : 'Todas'}
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm} ${styles.commandBarBtn} ${styles.commandRailBtn}`}
              onClick={() => setModal('add')}
            >
              <span className={styles.commandBarBtnIcon} aria-hidden>
                <KycPlusIcon size={14} />
              </span>
              Nueva
            </button>
            {checked.size > 0 && (
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSm} ${styles.danger} ${styles.commandRailBtn}`}
                onClick={onBulkDelete}
              >
                Eliminar ({checked.size})
              </button>
            )}
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm} ${styles.commandBarBtn} ${styles.commandRailBtn}`}
              onClick={openChat}
            >
              <span className={styles.commandBarBtnIcon} aria-hidden>
                <KycIconChatSm />
              </span>
              Chat
            </button>
          </div>
        </div>
      </div>
      <div className={styles.body}>
        {mobileListOpen ? (
          <div
            className={styles.asideDrawerBackdrop}
            role="presentation"
            onClick={() => setMobileListOpen(false)}
          />
        ) : null}
        <aside
          id="kyc-company-list"
          className={`${styles.aside} ${mobileListOpen ? styles.asideMobileOpen : ''}`}
          aria-label="Lista de empresas KYC"
          aria-modal={mobileListOpen ? true : undefined}
        >
          <div className={styles.asideHeader}>
            <div className={styles.asideHeaderInner} ref={listIndustryFilterRef}>
              <div className={styles.asideHeaderTopRow}>
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
                <button
                  type="button"
                  className={`${styles.asideFilterIconBtn} ${listIndustryFilterOpen ? styles.asideFilterIconBtnOpen : ''} ${listIndustry.trim() ? styles.asideFilterIconBtnActive : ''}`}
                  aria-expanded={listIndustryFilterOpen}
                  aria-controls="kyc-list-industry-filter-panel"
                  aria-label={
                    listIndustry.trim()
                      ? listIndustryFilterOpen
                        ? `Cerrar filtro. Activo: ${industryLabel(listIndustry)}`
                        : `Filtrar lista. Activo: ${industryLabel(listIndustry)}`
                      : listIndustryFilterOpen
                        ? 'Cerrar filtro por industria'
                        : 'Filtrar la lista por industria'
                  }
                  title={
                    listIndustryFilterOpen
                      ? 'Cerrar filtro por industria'
                      : 'Filtrar la lista por industria de la ficha'
                  }
                  onClick={() => setListIndustryFilterOpen((v) => !v)}
                >
                  <span className={styles.asideFilterIconBtnGlyph} aria-hidden>
                    <KycIconFilterSm size={16} />
                  </span>
                  {listIndustry.trim() ? (
                    <span className={styles.asideFilterIconBadge} aria-hidden title="Hay un filtro de industria activo" />
                  ) : null}
                </button>
              </div>
              {listIndustryFilterOpen ? (
                <div
                  id="kyc-list-industry-filter-panel"
                  className={styles.asideHeaderFilterPanel}
                  role="region"
                  aria-label="Filtro por industria"
                >
                  <label className={styles.asideFilterPanelLabel} htmlFor="kyc-list-industry-select">
                    Industria en ficha
                  </label>
                  <select
                    id="kyc-list-industry-select"
                    className={styles.asideFilterSelect}
                    value={listIndustry}
                    onChange={(e) => setListIndustry(e.target.value)}
                  >
                    <option value="">Todas las industrias</option>
                    {USER_INDUSTRY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          </div>
          <div className={styles.asideListWrap}>
            {loadingList ? (
              <div className={styles.asideListLoader} aria-busy="true" aria-live="polite">
                <div className={styles.asideListLoaderSpinner} aria-hidden />
                <p className={styles.asideListLoaderText}>Cargando empresas…</p>
              </div>
            ) : (
              <div
                className={`${styles.list} ${listRevealOn ? styles.listReveal : ''} ${listCascadeOn ? styles.listCascade : ''}`}
              >
                {companies.map((c, index) => (
                  <CssStyled
                    as="div"
                    key={c.id}
                    className={`${styles.listItemRow} ${selId === c.id ? styles.listItemRowActive : ''}`}
                    cssProperties={{ '--list-i': index }}
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
                      aria-current={selId === c.id ? 'page' : undefined}
                      onClick={() => void selectCompany(c.id, { resetTab: true })}
                    >
                      <KycCompanyListAvatar website={c.website} name={c.name} />
                      <span className={styles.listRowSelectBody}>
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
                      </span>
                    </button>
                    <button
                      type="button"
                      className={styles.listRowIntakeBtn}
                      title="Entrevista guiada"
                      aria-label={`Iniciar entrevista guiada con ${c.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        void startIntake(c.id);
                      }}
                    >
                      <span className={styles.listRowIntakeBtnIcon} aria-hidden>
                        <KycToolbarInterviewIcon size={15} />
                      </span>
                    </button>
                  </CssStyled>
                ))}
                {!companies.length ? (
                  <div className={styles.listEmpty}>No hay empresas. Usa «+ Empresa» arriba.</div>
                ) : null}
              </div>
            )}
          </div>
        </aside>
        <main className={styles.main}>
          {selId != null && detailLoading ? (
            <div className={styles.detailSkeleton} aria-busy="true" aria-live="polite">
              <p className={styles.detailSkeletonTitle}>Cargando ficha…</p>
              <div className={styles.detailSkeletonBar} />
              <div className={styles.detailSkeletonBar} />
              <div className={`${styles.detailSkeletonBar} ${styles.detailSkeletonBarShort}`} />
            </div>
          ) : null}
          {!detail && !detailLoading && selId == null ? (
            <div className={styles.empty}>
              <div className={styles.emptyCard}>
                <div className={`${styles.emptyIcon} sap-icon sap-icon--launchpad`} aria-hidden />
                <h2 className={styles.emptyTitle}>Selecciona una empresa</h2>
                <p className={styles.emptyText}>
                  Elige una empresa en la lista (en pantallas estrechas usa el botón «Empresas» arriba) para ver su perfil KYC,
                  stack tecnológico, señales y pendientes.
                </p>
                <div className={styles.emptyActions}>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSecondary} ${styles.kycMobileOpenListBtn}`}
                    aria-controls="kyc-company-list"
                    onClick={() => setMobileListOpen(true)}
                  >
                    Lista de empresas
                  </button>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    onClick={() => setModal('add')}
                  >
                    + Empresa
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {detail && !detailLoading ? (
            <>
              <div className={styles.detailHeaderCard}>
                <div className={styles.detailToolbar}>
                  <h2 className={styles.detailToolbarTitle}>{escapeHtml(companyName)}</h2>
                  <div ref={detailDangerWrapRef} className={styles.detailToolbarActionsDanger}>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnSm} ${styles.danger} ${styles.detailToolbarBtn} ${styles.detailToolbarDeleteDesktop}`}
                      onClick={() => setConfirm('delOne')}
                    >
                      <span className={styles.detailToolbarBtnIcon} aria-hidden>
                        <KycToolbarTrashIcon />
                      </span>
                      <span className={styles.detailToolbarDeleteLabel}>Eliminar KYC</span>
                    </button>
                    <div className={styles.detailToolbarDangerOverflow}>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSm} ${styles.btnSecondary} ${styles.detailToolbarOverflowTrigger}`}
                        aria-expanded={detailDangerMenuOpen}
                        aria-haspopup="true"
                        aria-controls="kyc-detail-danger-menu"
                        aria-label="Más acciones de la cuenta"
                        onClick={() => setDetailDangerMenuOpen((o) => !o)}
                      >
                        <span className={styles.detailToolbarBtnIcon} aria-hidden>
                          <KycToolbarMoreIcon size={16} />
                        </span>
                      </button>
                      {detailDangerMenuOpen ? (
                        <div
                          id="kyc-detail-danger-menu"
                          role="menu"
                          className={styles.detailToolbarDangerMenu}
                          aria-label="Acciones adicionales"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            className={styles.detailToolbarDangerMenuItem}
                            onClick={() => {
                              setDetailDangerMenuOpen(false);
                              setConfirm('delOne');
                            }}
                          >
                            <span className={styles.detailToolbarBtnIcon} aria-hidden>
                              <KycToolbarTrashIcon />
                            </span>
                            Eliminar KYC
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className={styles.detailToolbarActions} role="toolbar" aria-label="Acciones de la cuenta KYC">
                    <div className={styles.detailToolbarActionsMain}>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm} ${styles.detailToolbarBtn}`}
                        aria-label="Informe PDF"
                        onClick={() => {
                          if (selId) window.open(`/kyc/report.html?id=${selId}`, '_blank');
                        }}
                      >
                        <span className={styles.detailToolbarBtnIcon} aria-hidden>
                          <KycToolbarPdfIcon />
                        </span>
                        <span className={styles.detailToolbarPdfLabel}>Informe</span>
                        <span className={styles.detailToolbarPdfLabelSuffix}> PDF</span>
                      </button>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm} ${styles.detailToolbarBtn}`}
                        title="Entrevista guiada"
                        onClick={() => {
                          if (selId) void startIntake(selId);
                        }}
                      >
                        <span className={styles.detailToolbarBtnIcon} aria-hidden>
                          <KycToolbarInterviewIcon />
                        </span>
                        Entrevista
                      </button>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm} ${styles.detailToolbarBtn}`}
                        disabled={refreshIntelBusy}
                        aria-busy={refreshIntelBusy}
                        title="Actualiza noticias, re-genera el resumen ejecutivo con IA, reprocesa «Presencia de Avvale en la cuenta» y regenera las hipótesis IA en Señales (si hay señales y clave Anthropic). Requiere clave de API."
                        onClick={async () => {
                          if (!selId) return;
                          setBanner(null);
                          setRefreshIntelBusy(true);
                          try {
                            const r = await kycJson<{
                              ok?: boolean;
                              news?: { created: number; total: number };
                              summary?: { ok: boolean };
                              avvale?: { ok: boolean; updated: boolean };
                              warning?: string;
                            }>(`/api/kyc/companies/${selId}/enrich`, { method: 'POST' });
                            const created = Number(r?.news?.created ?? 0);
                            const total = Number(r?.news?.total ?? 0);
                            const summaryOk = r?.summary?.ok === true;
                            const av = r?.avvale;
                            let avvaleLine = 'Presencia Avvale: sin cambios';
                            if (av?.updated)
                              avvaleLine =
                                'Presencia Avvale: fusionado y guardado (footprint IA; presencia por línea = unión de lo guardado + inferencia IA con criterios Avvale; notas manuales por línea conservadas; proyectos solo desde ficha)';
                            else if (av?.ok === true)
                              avvaleLine = 'Presencia Avvale: reprocesado; sin cambios respecto a la ficha guardada';
                            else if (av != null && av.ok === false)
                              avvaleLine = 'Presencia Avvale: sin actualización automática (KYC activo y clave de API)';
                            const parts = [
                              `Noticias: ${created} nueva${created === 1 ? '' : 's'} (${total} en el RSS)`,
                              summaryOk ? 'Resumen ejecutivo: actualizado' : 'Resumen ejecutivo: sin cambios',
                              avvaleLine,
                            ];
                            let hypLine: string;
                            try {
                              const h = await kycJson<{
                                ok?: boolean;
                                updated?: boolean;
                                count?: number;
                                message?: string;
                              }>(`/api/kyc/companies/${selId}/signals/infer-hypotheses`, { method: 'POST' });
                              const n = Number(h?.count ?? 0);
                              if (h?.updated) hypLine = `Hipótesis IA: ${n} guardada${n === 1 ? '' : 's'}`;
                              else if (h?.message) hypLine = `Hipótesis IA: ${h.message}`;
                              else hypLine = 'Hipótesis IA: sin cambios';
                            } catch (he) {
                              hypLine = `Hipótesis IA: error — ${(he as Error).message}`;
                            }
                            parts.push(hypLine);
                            setBanner(`${parts.join(' · ')}. Datos del cliente recargados.${r?.warning ? ` ${r.warning}` : ''}`);
                            void refreshDetailOnly(selId);
                            void loadCompanies();
                          } catch (er) {
                            setBanner('No se pudieron actualizar las noticias. ' + (er as Error).message);
                          } finally {
                            setRefreshIntelBusy(false);
                          }
                        }}
                      >
                        <span className={styles.detailToolbarBtnIcon} aria-hidden>
                          {refreshIntelBusy ? (
                            <span className={styles.detailToolbarSpinner} />
                          ) : (
                            <KycToolbarRefreshIcon />
                          )}
                        </span>
                        {refreshIntelBusy ? 'Actualizando…' : 'Actualizar'}
                      </button>
                    </div>
                  </div>
                </div>
                {detail.profile == null && selId && (
                  <p className={styles.detailHeaderCardActivate}>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}
                      onClick={async () => {
                        if (!selId) return;
                        await kycJson(`/api/kyc/companies/${selId}/activate`, { method: 'POST' });
                        void refreshDetailOnly(selId);
                      }}
                    >
                      Activar KYC
                    </button>
                  </p>
                )}
              </div>
              <div
                ref={kycTabsStripRef}
                className={styles.tabs}
                role="tablist"
                aria-label="Secciones del perfil KYC"
                aria-orientation="horizontal"
              >
                {TABS.map(([id, label]) => (
                  <button
                    key={id}
                    id={`kyc-tab-${id}`}
                    type="button"
                    role="tab"
                    tabIndex={tab === id ? 0 : -1}
                    aria-selected={tab === id}
                    aria-controls="kyc-tab-panel"
                    className={`${styles.tab} ${tab === id ? styles.tabActive : ''}`}
                    onClick={() => commitTab(id)}
                  >
                    {label}
                    {id === 'por_resolver' && openQCount > 0 ? ` (${openQCount})` : ''}
                  </button>
                ))}
              </div>
              <div id="kyc-tab-panel" role="tabpanel" aria-labelledby={`kyc-tab-${tab}`}>
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
              {tab === 'avvale_projects' && selId && (
                <KycAvvaleProjectsPanel
                  companyId={selId}
                  profile={(detail.profile as Record<string, unknown> | null) ?? null}
                  onRefetch={refetchNow}
                  onBanner={setBanner}
                />
              )}
              {tab === 'avvale' && selId && (
                <KycAvvalePanel
                  companyId={selId}
                  profile={(detail.profile as Record<string, unknown> | null) ?? null}
                  onRefetch={refetchNow}
                  onBanner={setBanner}
                />
              )}
              {tab === 'organigrama' && selId && (
                <KycOrgPanel
                  companyId={selId}
                  companyName={String((detail.company as Record<string, unknown>).name ?? 'Empresa')}
                  members={detail.org.members}
                  rels={detail.org.relationships}
                  onRefetch={refetchNow}
                  onBanner={setBanner}
                />
              )}
              {tab === 'stack' && (
                <KycStackView
                  techStack={(((detail.profile as Record<string, unknown> | null) || {})?.tech_stack as object) ?? {}}
                  onGotoDashboard={() => commitTab('dashboard')}
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
                    commitTab('dashboard');
                    setProfileFocus(f);
                  }}
                  onGoOrganigrama={() => commitTab('organigrama')}
                />
              )}
              {tab === 'rfqs' && selId && (
                <KycRfqsPanel
                  companyId={selId}
                  companyName={String((detail.company as Record<string, unknown>).name ?? 'Empresa')}
                  onBanner={setBanner}
                />
              )}
              {tab === 'signals' && selId && (
                <KycSignalsPanel
                  companyId={selId}
                  signals={detail.signals as { id: number; source: string; source_url: string | null; title: string | null; text: string | null; sentiment: string | null; published_at: string | null }[]}
                  signalIntel={(detail.profile as Record<string, unknown> | null)?.signal_intel ?? null}
                  onRefetch={refetchNow}
                  onBanner={setBanner}
                />
              )}
              </div>
            </>
          ) : null}
        </main>
        {refreshIntelBusy && (
          <div className={styles.intelRefreshOverlay} role="status" aria-live="polite" aria-busy="true">
            <div className={styles.intelRefreshCard}>
              <h3 className={styles.intelRefreshTitle}>Reprocesando inteligencia del cliente</h3>
              <p className={styles.intelRefreshDesc}>
                Actualización en curso: noticias, resumen ejecutivo con IA y bloque Presencia / Avvale en la cuenta
                (fusionado con lo que ya tenías en ficha). Puedes esperar en esta pantalla.
              </p>
              <div className={styles.intelRefreshBar} aria-hidden />
              <ul className={styles.intelRefreshSteps}>
                <li className={styles.intelRefreshStep}>
                  <span className={styles.intelRefreshDot} aria-hidden />
                  Señales y noticias
                </li>
                <li className={styles.intelRefreshStep}>
                  <span className={styles.intelRefreshDot} aria-hidden />
                  Normalización del stack tecnológico
                </li>
                <li className={styles.intelRefreshStep}>
                  <span className={styles.intelRefreshDot} aria-hidden />
                  Resumen ejecutivo (IA)
                </li>
                <li className={styles.intelRefreshStep}>
                  <span className={styles.intelRefreshDot} aria-hidden />
                  Presencia Avvale / footprint (IA, sin noticias RSS en contexto)
                </li>
              </ul>
              <span className={styles.srOnly}>Reprocesamiento en curso; espere a que finalice la petición.</span>
            </div>
          </div>
        )}
      </div>
      {chatPortalReady && showChatPanel ? createPortal(chatPanel, document.body) : null}
      {modal === 'add' && (
        <div className={styles.modalOverlay} onClick={() => setModal(null)} role="presentation">
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>Añadir cliente</h2>
            <div className={styles.formRow}>
              <label className={styles.label}>Nombre empresa *</label>
              <input className={styles.input} value={addName} onChange={(e) => setAddName(e.target.value)} />
            </div>
            <div className={`${styles.row} ${styles.rowGapMd}`}>
              <div className={`${styles.formRow} ${styles.formRowFlex}`}>
                <label className={styles.label}>Sector</label>
                <input className={styles.input} value={addSector} onChange={(e) => setAddSector(e.target.value)} />
              </div>
              <div className={`${styles.formRow} ${styles.formRowFlex}`}>
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
              <div className={`${styles.formRow} ${styles.formRowFlex}`}>
                <label className={styles.label}>Ciudad</label>
                <input className={styles.input} value={addCity} onChange={(e) => setAddCity(e.target.value)} />
              </div>
            </div>
            <div className={styles.formRow}>
              <label className={styles.label}>Website (ej: acme.com)</label>
              <input className={styles.input} value={addWebsite} onChange={(e) => setAddWebsite(e.target.value)} />
            </div>
            <div className={`${styles.row} ${styles.rowGapMd}`}>
              <div className={`${styles.formRow} ${styles.formRowFlex}`}>
                <label className={styles.label}>Facturación</label>
                <input className={styles.input} value={addRevenue} onChange={(e) => setAddRevenue(e.target.value)} />
              </div>
              <div className={`${styles.formRow} ${styles.formRowFlex}`}>
                <label className={styles.label}>Empleados</label>
                <input className={styles.input} value={addEmployees} onChange={(e) => setAddEmployees(e.target.value)} />
              </div>
            </div>
            <div className={styles.formRow}>
              <label className={styles.label}>Notas</label>
              <textarea className={styles.textareaLg} value={addNotes} onChange={(e) => setAddNotes(e.target.value)} />
            </div>
            <label className={`${styles.row} ${styles.clickableRow}`}>
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
