'use client';

import { FormEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PageBreadcrumb, PageBackLink, PageHero } from '@/components/page-hero';
import { apiFetch, redirectToLogin } from '@/lib/api';
import styles from './page.module.css';

type CatalogItem = {
  tipoSw: string;
  practica: string;
};

type SwLine = {
  id: string;
  tipoSw: string;
  precioVenta: string;
  coste: string;
  practica: string;
};

const DEPLOYMENT_TYPES = [
  { value: 'ON_PREMISE', label: 'On Premise' },
  { value: 'CLOUD', label: 'Cloud' },
  { value: 'IAAS_RESELL', label: 'IaaS Resell' },
] as const;
type DeploymentType = (typeof DEPLOYMENT_TYPES)[number]['value'];

const newLine = (): SwLine => ({
  id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  tipoSw: '',
  precioVenta: '',
  coste: '',
  practica: '',
});

function RequiredMark() {
  return (
    <span className={styles.requiredMark} aria-hidden="true">
      *
    </span>
  );
}

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function splitTipoSw(tipoSw: string): { title: string; kind: 'license' | 'maintenance' | null } {
  if (/maintenance/i.test(tipoSw)) {
    const title = tipoSw.replace(/\s*[-–]?\s*maintenance.*$/i, '').trim();
    return { title: title || tipoSw, kind: 'maintenance' };
  }
  if (/licen[cs]e/i.test(tipoSw)) {
    const title = tipoSw.replace(/\s*[-–]?\s*licen[cs]e.*$/i, '').trim();
    return { title: title || tipoSw, kind: 'license' };
  }
  return { title: tipoSw, kind: null };
}

function practiceTone(practica: string): string {
  const p = practica.toUpperCase();
  if (p.includes('SAIBORG')) return 'saiborg';
  if (p.includes('YUBIQ')) return 'yubiq';
  if (p.includes('GROW')) return 'grow';
  if (p.includes('WISE')) return 'wise';
  if (p.includes('AXAZURE')) return 'axazure';
  if (p.includes('RUN')) return 'run';
  return 'default';
}

function practiceShortLabel(practica: string): string {
  const cleaned = practica.replace(/^100%\s*/i, '').trim();
  return cleaned || practica;
}

function SwTypeCombobox({
  value,
  catalog,
  disabled,
  loading,
  onChange,
}: {
  value: string;
  catalog: CatalogItem[];
  disabled?: boolean;
  loading?: boolean;
  onChange: (tipoSw: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    if (!q) return catalog;
    return catalog.filter(
      (item) => normalizeSearch(item.tipoSw).includes(q) || normalizeSearch(item.practica).includes(q),
    );
  }, [catalog, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const option = document.getElementById(`${listId}-opt-${activeIndex}`);
    option?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open, listId]);

  useEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }

    let frame = 0;
    const updatePosition = () => {
      const anchor = wrapRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const gap = 6;
      const spaceBelow = window.innerHeight - rect.bottom - gap - 12;
      const spaceAbove = rect.top - gap - 12;
      const preferBelow = spaceBelow >= 180 || spaceBelow >= spaceAbove;
      const maxHeight = Math.min(360, Math.max(180, preferBelow ? spaceBelow : spaceAbove));
      const top = preferBelow ? rect.bottom + gap : Math.max(12, rect.top - gap - maxHeight);
      const width = Math.min(Math.max(rect.width, 22 * 16), Math.min(window.innerWidth - 24, 34 * 16));
      const left = Math.min(rect.left, window.innerWidth - width - 12);
      const next = { top, left: Math.max(12, left), width, maxHeight };
      setMenuPos((prev) => {
        if (
          prev &&
          Math.abs(prev.top - next.top) < 0.5 &&
          Math.abs(prev.left - next.left) < 0.5 &&
          Math.abs(prev.width - next.width) < 0.5 &&
          Math.abs(prev.maxHeight - next.maxHeight) < 0.5
        ) {
          return prev;
        }
        return next;
      });
    };

    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updatePosition);
    };

    const onScroll = (event: Event) => {
      if (panelRef.current && event.target instanceof Node && panelRef.current.contains(event.target)) {
        return;
      }
      scheduleUpdate();
    };

    updatePosition();
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
      setQuery(value);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, value]);

  const selectItem = (item: CatalogItem) => {
    onChange(item.tipoSw);
    setQuery(item.tipoSw);
    setOpen(false);
    inputRef.current?.blur();
  };

  const commitOrRevert = () => {
    const exact = catalog.find((item) => normalizeSearch(item.tipoSw) === normalizeSearch(query));
    if (exact) {
      onChange(exact.tipoSw);
      setQuery(exact.tipoSw);
      return;
    }
    if (query.trim() === '') {
      onChange('');
      setQuery('');
      return;
    }
    setQuery(value);
  };

  const list =
    open && !loading && menuPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={panelRef}
            className={styles.swTypePanel}
            style={{
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
              maxHeight: menuPos.maxHeight,
            }}
          >
            <div className={styles.swTypeListMeta}>
              <span>
                {filtered.length === 0
                  ? 'Sin resultados'
                  : `${filtered.length} ${filtered.length === 1 ? 'resultado' : 'resultados'}`}
              </span>
              {query.trim() ? <span className={styles.swTypeListMetaQuery}>«{query.trim()}»</span> : null}
            </div>
            <ul id={listId} ref={listRef} className={styles.swTypeList} role="listbox" aria-label="Tipos de software">
              {filtered.length === 0 ? (
                <li className={styles.swTypeEmpty} role="presentation">
                  Prueba con otro nombre de producto o una práctica (RUN, GROW, YUBIQ…).
                </li>
              ) : (
                filtered.map((item, index) => {
                  const selected = item.tipoSw === value;
                  const active = index === activeIndex;
                  const { title, kind } = splitTipoSw(item.tipoSw);
                  const tone = practiceTone(item.practica);
                  return (
                    <li key={`${item.tipoSw}-${item.practica}-${index}`} role="presentation">
                      <button
                        type="button"
                        id={`${listId}-opt-${index}`}
                        role="option"
                        aria-selected={selected}
                        className={`${styles.swTypeOption} ${selected ? styles.swTypeOptionSelected : ''} ${active ? styles.swTypeOptionActive : ''}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => selectItem(item)}
                      >
                        <span className={styles.swTypeOptionMain}>
                          <span className={styles.swTypeOptionName}>{title}</span>
                          <span className={styles.swTypeOptionMeta}>
                            {kind ? (
                              <span
                                className={`${styles.swTypeKindChip} ${
                                  kind === 'license' ? styles.swTypeKindLicense : styles.swTypeKindMaintenance
                                }`}
                              >
                                {kind === 'license' ? 'License' : 'Maintenance'}
                              </span>
                            ) : null}
                            <span className={styles.swTypePracticeChip} data-tone={tone} title={item.practica}>
                              {practiceShortLabel(item.practica)}
                            </span>
                          </span>
                        </span>
                        {selected ? (
                          <span className={styles.swTypeOptionCheck} aria-hidden>
                            ✓
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={wrapRef} className={`${styles.swTypeCombobox} ${open ? styles.swTypeComboboxOpen : ''}`}>
      <div className={styles.swTypeInputWrap}>
        <input
          ref={inputRef}
          className={`${styles.input} ${styles.swTypeInput}`}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && filtered[activeIndex] ? `${listId}-opt-${activeIndex}` : undefined}
          value={query}
          placeholder={loading ? 'Cargando catálogo…' : 'Buscar tipo de SW o práctica'}
          required
          disabled={disabled || loading}
          autoComplete="off"
          onFocus={() => {
            if (!disabled && !loading) setOpen(true);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            if (event.target.value.trim() === '') onChange('');
          }}
          onBlur={() => {
            window.setTimeout(() => {
              if (
                !wrapRef.current?.contains(document.activeElement) &&
                !panelRef.current?.contains(document.activeElement)
              ) {
                commitOrRevert();
                setOpen(false);
              }
            }, 120);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (event.key === 'Enter' && open && filtered[activeIndex]) {
              event.preventDefault();
              selectItem(filtered[activeIndex]);
            } else if (event.key === 'Escape') {
              event.preventDefault();
              setQuery(value);
              setOpen(false);
            }
          }}
        />
        <button
          type="button"
          className={styles.swTypeChevronBtn}
          tabIndex={-1}
          aria-label={open ? 'Cerrar listado' : 'Abrir listado'}
          disabled={disabled || loading}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (disabled || loading) return;
            setOpen((v) => !v);
            inputRef.current?.focus();
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M8 11L3 6h10l-5 5z" fill="currentColor" />
          </svg>
        </button>
      </div>
      {list}
    </div>
  );
}

export default function SwFormsPage() {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [clienteFacturar, setClienteFacturar] = useState('');
  const [fechaAceptacion, setFechaAceptacion] = useState('');
  const [fechaReconocimiento, setFechaReconocimiento] = useState('');
  const [fechaInicioMantenimiento, setFechaInicioMantenimiento] = useState('');
  const [fechaFinMantenimiento, setFechaFinMantenimiento] = useState('');
  const [aniosReconocer, setAniosReconocer] = useState('');
  const [codigoOferta, setCodigoOferta] = useState('');
  const [codigoMantenimiento, setCodigoMantenimiento] = useState('');
  const [comentarios, setComentarios] = useState('');
  const [tipo, setTipo] = useState<DeploymentType | ''>('');
  const [lineas, setLineas] = useState<SwLine[]>([newLine()]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewClosing, setPreviewClosing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      setCatalogLoading(true);
      setError(null);
      try {
        const res = await apiFetch('/api/sw-forms/catalog');
        if (res.status === 401) {
          redirectToLogin();
          return;
        }
        if (!res.ok) {
          throw new Error('No se pudo cargar el catálogo de tipos de SW.');
        }
        const data = (await res.json()) as CatalogItem[];
        if (!cancelled) setCatalog(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo cargar el catálogo de tipos de SW.');
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }

    loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (tipo === 'ON_PREMISE') return;
    setFechaInicioMantenimiento('');
    setFechaFinMantenimiento('');
    setCodigoMantenimiento('');
  }, [tipo]);

  useEffect(() => {
    if (!previewOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePreview();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [previewOpen]);

  const findCatalogItem = (tipoSw: string) => catalog.find((item) => item.tipoSw === tipoSw);

  const updateLine = (id: string, patch: Partial<SwLine>) => {
    setLineas((current) =>
      current.map((line) => {
        if (line.id !== id) return line;
        const next = { ...line, ...patch };
        if (patch.tipoSw !== undefined) {
          next.practica = findCatalogItem(patch.tipoSw)?.practica ?? '';
        }
        return next;
      }),
    );
  };

  const addLine = () => setLineas((current) => [...current, newLine()]);

  const removeLine = (id: string) => {
    setLineas((current) => (current.length === 1 ? current : current.filter((line) => line.id !== id)));
  };

  const totalPrecio = lineas.reduce((sum, line) => sum + numberValue(line.precioVenta), 0);
  const totalCoste = lineas.reduce((sum, line) => sum + numberValue(line.coste), 0);
  const totalMargen = totalPrecio - totalCoste;
  const previewRows = lineas.map((line) => {
    const target = targetFromTipoSw(line.tipoSw);
    const precioVenta = numberValue(line.precioVenta);
    const coste = numberValue(line.coste);
    return { ...line, target, precioVenta, coste, margen: precioVenta - coste };
  });
  const previewTotals = previewRows.reduce(
    (acc, line) => {
      if (line.target === 'maintenance') {
        acc.maintenancePrice += line.precioVenta;
        acc.maintenanceCost += line.coste;
        return acc;
      }
      acc.licensePrice += line.precioVenta;
      acc.licenseCost += line.coste;
      return acc;
    },
    { licensePrice: 0, licenseCost: 0, maintenancePrice: 0, maintenanceCost: 0 },
  );
  const deploymentLabel = DEPLOYMENT_TYPES.find((option) => option.value === tipo)?.label ?? tipo;

  const handlePreview = () => {
    setError(null);
    setSuccess(null);
    const validation = validateForm({
      clienteFacturar,
      fechaAceptacion,
      fechaReconocimiento,
      fechaInicioMantenimiento,
      fechaFinMantenimiento,
      aniosReconocer,
      codigoOferta,
      codigoMantenimiento,
      tipo,
      lineas,
    });
    if (validation) {
      setError(validation);
      return;
    }
    setPreviewClosing(false);
    setPreviewOpen(true);
  };

  const closePreview = () => {
    setPreviewClosing(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const validation = validateForm({
      clienteFacturar,
      fechaAceptacion,
      fechaReconocimiento,
      fechaInicioMantenimiento,
      fechaFinMantenimiento,
      aniosReconocer,
      codigoOferta,
      codigoMantenimiento,
      tipo,
      lineas,
    });
    if (validation) {
      setError(validation);
      return;
    }

    setGenerating(true);
    try {
      const res = await apiFetch('/api/sw-forms/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteFacturar,
          fechaAceptacion,
          fechaReconocimiento,
          codigoOferta,
          ...(tipo === 'ON_PREMISE'
            ? {
                fechaInicioMantenimiento,
                fechaFinMantenimiento,
                codigoMantenimiento,
              }
            : {}),
          aniosReconocer: Number(aniosReconocer),
          comentarios: comentarios.trim() || undefined,
          tipo,
          lineas: lineas.map((line) => ({
            tipoSw: line.tipoSw,
            precioVenta: parseCurrencyNumber(line.precioVenta),
            coste: parseCurrencyNumber(line.coste),
            practica: line.practica,
          })),
        }),
      });

      if (res.status === 401) {
        redirectToLogin();
        return;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(extractApiError(text) ?? 'No se pudo generar el Excel.');
      }

      const blob = await res.blob();
      const fileName = fileNameFromContentDisposition(res.headers.get('Content-Disposition')) ?? 'Formulario de SW.xlsx';
      downloadBlob(blob, fileName);
      setSuccess('Excel generado correctamente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el Excel.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageIntro}>
        <PageBreadcrumb>
          <PageBackLink href="/launcher">← App Launcher</PageBackLink>
        </PageBreadcrumb>
        <PageHero
          animateEnter={false}
          title="Crear nuevo formulario"
          subtitle="Genera el Excel de pre-contabilización de software desde la plantilla oficial."
        />
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}
      {success ? <div className={styles.success}>{success}</div> : null}

      <form className={styles.form} onSubmit={handleSubmit}>
        <section className={styles.primaryCard}>
          <div className={styles.cardSection}>
            <div className={styles.sectionHead}>
              <span className={styles.stepBadge} aria-hidden>
                1
              </span>
              <div>
                <h2 className={styles.sectionTitle}>Datos generales</h2>
                <p className={styles.sectionDesc}>
                  Estos campos se escriben en la cabecera de la hoja Pre-Contabilización. El tipo se conserva solo en la UI.
                </p>
              </div>
            </div>

            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span className={styles.label}>
                  Tipo
                  <RequiredMark />
                </span>
                <select
                  className={styles.input}
                  value={tipo}
                  onChange={(event) => setTipo(event.target.value as DeploymentType | '')}
                  required
                >
                  <option value="" disabled>
                    Seleccionar…
                  </option>
                  {DEPLOYMENT_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.label}>
                  Años a reconocer
                  <RequiredMark />
                </span>
                <input
                  className={styles.input}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={2}
                  value={aniosReconocer}
                  onChange={(event) => setAniosReconocer(sanitizeYearsInput(event.target.value))}
                  placeholder="Ej. 3"
                  required
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>
                  Cliente a facturar
                  <RequiredMark />
                </span>
                <input
                  className={styles.input}
                  value={clienteFacturar}
                  onChange={(event) => setClienteFacturar(event.target.value)}
                  placeholder="Ej. Avvale Spain"
                  required
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>
                  Fecha Aceptación
                  <RequiredMark />
                </span>
                <input
                  className={styles.input}
                  type="date"
                  value={fechaAceptacion}
                  onChange={(event) => setFechaAceptacion(event.target.value)}
                  required
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>
                  Fecha de reconocimiento
                  <RequiredMark />
                </span>
                <input
                  className={styles.input}
                  type="date"
                  value={fechaReconocimiento}
                  onChange={(event) => setFechaReconocimiento(event.target.value)}
                  required
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>
                  Fecha Inicio del mantenimiento
                  {tipo === 'ON_PREMISE' ? <RequiredMark /> : null}
                </span>
                <input
                  className={styles.input}
                  type="date"
                  value={fechaInicioMantenimiento}
                  onChange={(event) => setFechaInicioMantenimiento(event.target.value)}
                  required={tipo === 'ON_PREMISE'}
                  disabled={tipo !== 'ON_PREMISE'}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>
                  Fecha Fin del mantenimiento
                  {tipo === 'ON_PREMISE' ? <RequiredMark /> : null}
                </span>
                <input
                  className={styles.input}
                  type="date"
                  value={fechaFinMantenimiento}
                  onChange={(event) => setFechaFinMantenimiento(event.target.value)}
                  required={tipo === 'ON_PREMISE'}
                  disabled={tipo !== 'ON_PREMISE'}
                />
              </label>
            </div>
          </div>
        </section>

        <section className={styles.primaryCard}>
          <div className={styles.cardSection}>
            <div className={styles.sectionHeaderLine}>
              <div className={styles.sectionHead}>
                <span className={styles.stepBadge} aria-hidden>
                  2
                </span>
                <div>
                  <h2 className={styles.sectionTitle}>Líneas de software</h2>
                  <p className={styles.sectionDesc}>
                    Elige el tipo de SW de la plantilla. La práctica se completa con el catálogo oficial.
                  </p>
                </div>
              </div>
              <button type="button" className={styles.btnSecondary} onClick={addLine} disabled={generating}>
                Añadir línea
              </button>
            </div>

            <div className={styles.linesTable} aria-busy={catalogLoading}>
              <div className={styles.linesHead} aria-hidden>
                <span>
                  Tipo de SW
                  <RequiredMark />
                </span>
                <span>
                  Precio de Venta
                  <RequiredMark />
                </span>
                <span>
                  Coste
                  <RequiredMark />
                </span>
                <span>Margen</span>
                <span>Práctica</span>
                <span />
              </div>

              {lineas.map((line, index) => {
                const margin = numberValue(line.precioVenta) - numberValue(line.coste);
                return (
                  <div key={line.id} className={styles.lineRow}>
                    <label className={styles.lineField}>
                      <span className={styles.mobileLabel}>
                        Tipo de SW
                        <RequiredMark />
                      </span>
                      <SwTypeCombobox
                        value={line.tipoSw}
                        catalog={catalog}
                        loading={catalogLoading}
                        disabled={generating}
                        onChange={(tipoSw) => updateLine(line.id, { tipoSw })}
                      />
                    </label>
                    <label className={styles.lineField}>
                      <span className={styles.mobileLabel}>
                        Precio de Venta
                        <RequiredMark />
                      </span>
                      <span className={styles.currencyInputWrap}>
                        <input
                          className={`${styles.input} ${styles.currencyInput}`}
                          type="text"
                          inputMode="decimal"
                          value={line.precioVenta}
                          onChange={(event) => updateLine(line.id, { precioVenta: sanitizeCurrencyInput(event.target.value) })}
                          onBlur={() => updateLine(line.id, { precioVenta: formatCurrencyInput(line.precioVenta) })}
                          placeholder="Ej. 1.250,00"
                          required
                          disabled={generating}
                        />
                        <span className={styles.currencySuffix} aria-hidden>
                          €
                        </span>
                      </span>
                    </label>
                    <label className={styles.lineField}>
                      <span className={styles.mobileLabel}>
                        Coste
                        <RequiredMark />
                      </span>
                      <span className={styles.currencyInputWrap}>
                        <input
                          className={`${styles.input} ${styles.currencyInput}`}
                          type="text"
                          inputMode="decimal"
                          value={line.coste}
                          onChange={(event) => updateLine(line.id, { coste: sanitizeCurrencyInput(event.target.value) })}
                          onBlur={() => updateLine(line.id, { coste: formatCurrencyInput(line.coste) })}
                          placeholder="Ej. 850,00"
                          required
                          disabled={generating}
                        />
                        <span className={styles.currencySuffix} aria-hidden>
                          €
                        </span>
                      </span>
                    </label>
                    <div className={styles.marginPreview}>
                      <span className={styles.mobileLabel}>Margen</span>
                      {formatCurrency(margin)}
                    </div>
                    <div className={styles.practicePreview}>
                      <span className={styles.mobileLabel}>Práctica</span>
                      {line.practica || 'Pendiente'}
                    </div>
                    <button
                      type="button"
                      className={styles.removeButton}
                      onClick={() => removeLine(line.id)}
                      disabled={generating || lineas.length === 1}
                      aria-label={`Eliminar línea ${index + 1}`}
                    >
                      Eliminar
                    </button>
                  </div>
                );
              })}
            </div>

            <div className={styles.summaryBar}>
              <span>
                Venta: <strong>{formatCurrency(totalPrecio)}</strong>
              </span>
              <span>
                Coste: <strong>{formatCurrency(totalCoste)}</strong>
              </span>
              <span>
                Margen: <strong>{formatCurrency(totalMargen)}</strong>
              </span>
            </div>
          </div>
        </section>

        <section className={styles.primaryCard}>
          <div className={styles.cardSection}>
            <div className={styles.sectionHead}>
              <span className={styles.stepBadge} aria-hidden>
                3
              </span>
              <div>
                <h2 className={styles.sectionTitle}>Códigos</h2>
                <p className={styles.sectionDesc}>
                  El código de mantenimiento solo aplica cuando el tipo seleccionado es On Premise.
                </p>
              </div>
            </div>

            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span className={styles.label}>
                  Código de oferta
                  <RequiredMark />
                </span>
                <input
                  className={styles.input}
                  value={codigoOferta}
                  onChange={(event) => setCodigoOferta(event.target.value)}
                  placeholder="ESP_XX_XXXX - Licencia"
                  required
                />
              </label>
              {tipo === 'ON_PREMISE' ? (
                <label className={styles.field}>
                  <span className={styles.label}>
                    Código de mantenimiento
                    <RequiredMark />
                  </span>
                  <input
                    className={styles.input}
                    value={codigoMantenimiento}
                    onChange={(event) => setCodigoMantenimiento(event.target.value)}
                    placeholder="ESP_XX_XXXX - Mantenimiento"
                    required
                  />
                </label>
              ) : null}
            </div>
          </div>
        </section>

        <section className={styles.primaryCard}>
          <div className={styles.cardSection}>
            <div className={styles.sectionHead}>
              <span className={styles.stepBadge} aria-hidden>
                4
              </span>
              <div>
                <h2 className={styles.sectionTitle}>Comentarios</h2>
                <p className={styles.sectionDesc}>Añade observaciones opcionales para incluirlas en el Excel.</p>
              </div>
            </div>

            <label className={styles.field}>
              <span className={styles.label}>Comentarios</span>
              <textarea
                className={`${styles.input} ${styles.textarea}`}
                value={comentarios}
                onChange={(event) => setComentarios(event.target.value)}
                maxLength={1000}
                placeholder="Añade cualquier observación relevante para la pre-contabilización."
                rows={4}
              />
            </label>
          </div>
        </section>

        <div className={styles.formFooter}>
          <p className={styles.footerHint}>
            El Excel descargado conserva la plantilla y escribe las líneas en columnas de Licencia o Mantenimiento según el tipo seleccionado.
          </p>
          <div className={styles.footerActions}>
            <button type="button" className={styles.btnSecondary} disabled>
              Utilizar
            </button>
            <button type="button" className={styles.btnSecondary} onClick={handlePreview} disabled={catalogLoading || generating}>
              Previsualizar
            </button>
            <button type="submit" className={styles.btnPrimary} disabled={generating || catalogLoading}>
              {generating ? 'Generando...' : 'Generar Excel'}
            </button>
          </div>
        </div>
      </form>

      {previewOpen
        ? createPortal(
        <div
          className={`${styles.previewOverlay} ${previewClosing ? styles.previewOverlayClosing : ''}`}
          role="presentation"
          onClick={closePreview}
          onAnimationEnd={(event) => {
            if (event.currentTarget !== event.target || !previewClosing) return;
            setPreviewOpen(false);
            setPreviewClosing(false);
          }}
        >
          <div
            className={styles.previewModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sw-form-preview-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.previewHeader}>
              <div>
                <p className={styles.previewKicker}>Previsualización</p>
                <h2 id="sw-form-preview-title" className={styles.previewTitle}>
                  Pre-Contabilización
                </h2>
              </div>
              <button type="button" className={styles.previewCloseButton} onClick={closePreview} aria-label="Cerrar previsualización">
                Cerrar
              </button>
            </div>

            <div className={styles.previewSheet}>
              <div className={styles.previewGrid}>
                <div className={styles.previewLabel}>Cliente</div>
                <div>{clienteFacturar}</div>
                <div className={styles.previewLabel}>Código Licencia</div>
                <div>{codigoOferta}</div>
                <div className={styles.previewLabel}>Fecha aceptación</div>
                <div>{formatDisplayDate(fechaAceptacion)}</div>
                <div className={styles.previewLabel}>Código Mantenimiento</div>
                <div>{tipo === 'ON_PREMISE' ? codigoMantenimiento : '-'}</div>
                <div className={styles.previewLabel}>Fecha reconocimiento</div>
                <div>{formatDisplayDate(fechaReconocimiento)}</div>
                <div className={styles.previewLabel}>Tipo</div>
                <div>{deploymentLabel}</div>
                <div className={styles.previewLabel}>Inicio mantenimiento</div>
                <div>{tipo === 'ON_PREMISE' ? formatDisplayDate(fechaInicioMantenimiento) : '-'}</div>
                <div className={styles.previewLabel}>Fin mantenimiento</div>
                <div>{tipo === 'ON_PREMISE' ? formatDisplayDate(fechaFinMantenimiento) : '-'}</div>
                <div className={styles.previewLabel}>Años a reconocer</div>
                <div>{aniosReconocer}</div>
              </div>

              <div className={styles.previewTableWrap}>
                <table className={styles.previewTable}>
                  <thead>
                    <tr>
                      <th>TIPO DE SW</th>
                      <th>PV Licencia</th>
                      <th>Coste Licencia</th>
                      <th>Margen Licencia</th>
                      <th>PV Mantenimiento</th>
                      <th>Coste Mantenimiento</th>
                      <th>Margen Mantenimiento</th>
                      <th>Práctica</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((line) => (
                      <tr key={line.id}>
                        <td>{line.tipoSw}</td>
                        <td>{line.target === 'license' ? formatCurrency(line.precioVenta) : '-'}</td>
                        <td>{line.target === 'license' ? formatCurrency(line.coste) : '-'}</td>
                        <td>{line.target === 'license' ? formatCurrency(line.margen) : '-'}</td>
                        <td>{line.target === 'maintenance' ? formatCurrency(line.precioVenta) : '-'}</td>
                        <td>{line.target === 'maintenance' ? formatCurrency(line.coste) : '-'}</td>
                        <td>{line.target === 'maintenance' ? formatCurrency(line.margen) : '-'}</td>
                        <td>{line.practica}</td>
                      </tr>
                    ))}
                    <tr className={styles.previewTotalRow}>
                      <td>TOTAL GENERAL</td>
                      <td>{formatCurrency(previewTotals.licensePrice)}</td>
                      <td>{formatCurrency(previewTotals.licenseCost)}</td>
                      <td>{formatCurrency(previewTotals.licensePrice - previewTotals.licenseCost)}</td>
                      <td>{formatCurrency(previewTotals.maintenancePrice)}</td>
                      <td>{formatCurrency(previewTotals.maintenanceCost)}</td>
                      <td>{formatCurrency(previewTotals.maintenancePrice - previewTotals.maintenanceCost)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className={styles.previewComments}>
                <strong>COMENTARIOS</strong>
                <p>{comentarios.trim() || 'Sin comentarios.'}</p>
              </div>
            </div>
          </div>
        </div>,
          document.body,
        )
        : null}
    </div>
  );
}

function validateForm(values: {
  clienteFacturar: string;
  fechaAceptacion: string;
  fechaReconocimiento: string;
  fechaInicioMantenimiento: string;
  fechaFinMantenimiento: string;
  aniosReconocer: string;
  codigoOferta: string;
  codigoMantenimiento: string;
  tipo: DeploymentType | '';
  lineas: SwLine[];
}): string | null {
  if (!values.tipo) return 'Selecciona el tipo.';
  if (!values.clienteFacturar.trim()) return 'Indica el cliente a facturar.';
  if (!values.fechaAceptacion || !values.fechaReconocimiento) {
    return 'Completa las fechas de aceptación y reconocimiento.';
  }
  if (values.tipo === 'ON_PREMISE' && (!values.fechaInicioMantenimiento || !values.fechaFinMantenimiento)) {
    return 'Completa las fechas de mantenimiento para On Premise.';
  }
  if (!values.codigoOferta.trim()) return 'Indica el código de oferta.';
  if (values.tipo === 'ON_PREMISE' && !values.codigoMantenimiento.trim()) {
    return 'Indica el código de mantenimiento para On Premise.';
  }
  if (!isValidYears(values.aniosReconocer)) return 'Indica los años a reconocer con un número entero entre 1 y 10.';
  const invalidLine = values.lineas.find(
    (line) => !line.tipoSw.trim() || !isValidNumber(line.precioVenta) || !isValidNumber(line.coste) || !line.practica.trim(),
  );
  if (invalidLine) return 'Completa Tipo de SW, Precio de Venta, Coste y Práctica en todas las líneas.';
  return null;
}

function isValidNumber(value: string): boolean {
  if (value.trim() === '') return false;
  const number = parseCurrencyNumber(value);
  return Number.isFinite(number) && number >= 0;
}

function isValidYears(value: string): boolean {
  if (value.trim() === '') return false;
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 10;
}

function sanitizeYearsInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const number = Number(digits);
  return String(Math.min(number, 10));
}

function numberValue(value: string): number {
  const number = parseCurrencyNumber(value);
  return Number.isFinite(number) ? number : 0;
}

function parseCurrencyNumber(value: string): number {
  const trimmed = value.replace(/[€\s]/g, '').trim();
  if (!trimmed) return Number.NaN;
  if (trimmed.includes(',')) {
    return Number(trimmed.replace(/\./g, '').replace(',', '.'));
  }
  if (/^\d{1,3}(\.\d{3})+$/.test(trimmed)) {
    return Number(trimmed.replace(/\./g, ''));
  }
  return Number(trimmed.replace(/,/g, ''));
}

function sanitizeCurrencyInput(value: string): string {
  return value.replace(/[^\d.,]/g, '');
}

function formatCurrencyInput(value: string): string {
  const number = parseCurrencyNumber(value);
  if (!Number.isFinite(number)) return value;
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
}

function formatDisplayDate(value: string): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat('es-ES').format(new Date(`${value}T00:00:00`));
}

function targetFromTipoSw(tipoSw: string): 'license' | 'maintenance' {
  const isMaintenance = /maintenance/i.test(tipoSw);
  const isLicense = /licen[cs]e/i.test(tipoSw);
  return isMaintenance && !isLicense ? 'maintenance' : 'license';
}

function fileNameFromContentDisposition(value: string | null): string | null {
  if (!value) return null;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(value)?.[1];
  if (encoded) return decodeURIComponent(encoded);
  return /filename="([^"]+)"/i.exec(value)?.[1] ?? null;
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function extractApiError(text: string): string | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) return parsed.message.join(' ');
    return parsed.message ?? text;
  } catch {
    return text;
  }
}

