'use client';

/** Reglas de negocio (UI oferta): docs/YUBIQ_OFERTA_REGLAS.md */
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { CssStyled } from '@/components/CssStyled/CssStyled';
import { ALLOWED_YUBIQ_SEGMENTS } from '@/lib/yubiq';
import type { AreaCompania, ClaudeOfferExtraction } from '@/types/yubiq';
import styles from './ExtractionResultCard.module.css';

const AREA_OPTIONS: readonly AreaCompania[] = ALLOWED_YUBIQ_SEGMENTS;
const AREA_SELECT_OPTIONS: readonly (AreaCompania | '')[] = ['', ...AREA_OPTIONS];

function valueOrDash(v: string | null | undefined): string {
  const s = (v ?? '').trim();
  return s ? s : '—';
}

function marginOrDash(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${Math.round(v)} %`;
}

function splitImporteOferta(text: string): {
  parts: string[];
  totals: { label: string; amount: string }[];
  otherLines: string[];
} {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const totals: { label: string; amount: string }[] = [];
  const composition: string[] = [];

  for (const line of lines) {
    if (/^total\b/i.test(line)) {
      const colon = line.lastIndexOf(':');
      if (colon > 0) {
        totals.push({
          label: line.slice(0, colon).trim(),
          amount: line.slice(colon + 1).trim(),
        });
      } else {
        totals.push({ label: line, amount: '' });
      }
      continue;
    }
    composition.push(line);
  }

  const [first = '', ...otherLines] = composition;
  const parts = first.includes(' + ')
    ? first.split(/\s\+\s/).map((part) => part.trim()).filter(Boolean)
    : first
      ? [first]
      : [];

  return { parts, totals, otherLines };
}

function parseImportePart(part: string): { amount: string; note: string | null } {
  const match = part.match(/^(.*?)\s*\((.+)\)\s*$/);
  if (match) {
    return { amount: match[1].trim(), note: match[2].trim() };
  }
  return { amount: part, note: null };
}

function ImporteOfertaValue({ text }: { text: string }) {
  const raw = (text ?? '').trim();
  if (!raw) {
    return <p className={`${styles.value} ${styles.importeBody}`}>—</p>;
  }

  const { parts, totals, otherLines } = splitImporteOferta(raw);
  const showStructured = parts.length > 1 || totals.length > 0 || otherLines.length > 0;

  if (!showStructured) {
    return <p className={`${styles.value} ${styles.valuePre} ${styles.importeBody}`}>{raw}</p>;
  }

  return (
    <div className={styles.importeComposition}>
      {parts.length > 0 ? (
        <ul className={styles.importeParts} aria-label="Desglose del importe">
          {parts.map((part, index) => {
            const { amount, note } = parseImportePart(part);
            return (
              <li key={`${part}-${index}`} className={styles.importePartRow}>
                {index > 0 ? <span className={styles.importePartPlus} aria-hidden>+</span> : <span className={styles.importePartPlusSpacer} aria-hidden />}
                <div className={styles.importePart}>
                  <span className={styles.importePartAmount}>{amount}</span>
                  {note ? <span className={styles.importePartNote}>{note}</span> : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      {otherLines.map((line) => (
        <p key={line} className={`${styles.value} ${styles.importeOtherLine}`}>
          {line}
        </p>
      ))}
      {totals.map((total) => (
        <div key={`${total.label}-${total.amount}`} className={styles.importeRefTotal}>
          <span className={styles.importeRefTotalLabel}>{total.label}</span>
          {total.amount ? <span className={styles.importeRefTotalAmount}>{total.amount}</span> : null}
        </div>
      ))}
    </div>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
    >
      <path
        d="M12 3.5 2.5 20h19L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M12 9v4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
    >
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 16.5v-6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="12" cy="7.25" r="1.1" fill="currentColor" />
    </svg>
  );
}

function CompromisoInfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 320 });

  const updatePanelPosition = useCallback(() => {
    const btn = wrapRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const margin = 8;
    const pad = 6;
    const width = Math.min(24 * 16, Math.max(12 * 16, window.innerWidth - margin * 2));
    let left = rect.right - width;
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
    const maxPanelH = Math.min(window.innerHeight * 0.72, 32 * 16);
    let top = rect.bottom + pad;
    if (top + maxPanelH > window.innerHeight - margin) {
      const topAbove = rect.top - pad - maxPanelH;
      if (topAbove >= margin) {
        top = topAbove;
      } else {
        top = Math.max(margin, window.innerHeight - margin - maxPanelH);
      }
    }
    setPanelPos({ top, left, width });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePanelPosition();
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onScrollResize = () => updatePanelPosition();
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('scroll', onScrollResize, true);
    window.addEventListener('resize', onScrollResize);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('scroll', onScrollResize, true);
      window.removeEventListener('resize', onScrollResize);
    };
  }, [open, updatePanelPosition]);

  const panel =
    open && typeof document !== 'undefined' ? (
      <CssStyled
        as="div"
        ref={panelRef}
        id={panelId}
        role="region"
        aria-label="Detalle del cálculo del total de compromiso"
        className={styles.compromisoInfoPanel}
        cssProperties={{
          top: `${panelPos.top}px`,
          left: `${panelPos.left}px`,
          width: `${panelPos.width}px`,
        }}
      >
        {text}
      </CssStyled>
    ) : null;

  return (
    <div ref={wrapRef} className={styles.compromisoInfoWrap}>
      <button
        type="button"
        className={styles.compromisoInfoBtn}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        title="Detalle del cálculo del total de compromiso"
      >
        <InfoIcon className={styles.compromisoInfoIcon} />
        <span className="sr-only">Información sobre el total de compromiso</span>
      </button>
      {panel ? createPortal(panel, document.body) : null}
    </div>
  );
}

function useAreaMenuDismiss(
  open: boolean,
  wrapRef: RefObject<HTMLDivElement | null>,
  setOpen: (v: boolean) => void,
) {
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, setOpen, wrapRef]);
}

function AreaDropdown({
  value,
  labelId,
  hintId,
  disabled,
  onChange,
}: {
  value: AreaCompania | '';
  labelId: string;
  hintId: string;
  disabled: boolean;
  onChange?: (area: AreaCompania | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selectedValueId = useId();
  const currentLabel = value || '—';

  useAreaMenuDismiss(open, wrapRef, setOpen);

  const commit = (next: AreaCompania | '') => {
    onChange?.(next === '' ? null : next);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className={styles.areaSelectWrap}>
      <button
        type="button"
        className={styles.areaSelectButton}
        data-area={value || undefined}
        aria-labelledby={`${labelId} ${selectedValueId}`}
        aria-describedby={hintId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span id={selectedValueId}>{currentLabel}</span>
        <ChevronIcon className={styles.areaSelectChevron} />
      </button>
      {open ? (
        <div id={listboxId} className={styles.areaSelectPopover} role="listbox" aria-labelledby={labelId}>
          {AREA_SELECT_OPTIONS.map((area) => {
            const label = area || '—';
            const selected = area === value;
            return (
              <button
                key={area || 'empty'}
                type="button"
                role="option"
                aria-selected={selected}
                className={`${styles.areaSelectOption} ${selected ? styles.areaSelectOptionActive : ''}`}
                data-area={area || undefined}
                onClick={() => commit(area)}
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function SecondaryAreasPicker({
  values,
  excludeArea,
  labelId,
  hintId,
  disabled,
  onChange,
}: {
  values: AreaCompania[];
  excludeArea: AreaCompania | null;
  labelId: string;
  hintId: string;
  disabled: boolean;
  onChange?: (areas: AreaCompania[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const available = AREA_OPTIONS.filter((area) => area !== excludeArea && !values.includes(area));

  useAreaMenuDismiss(open, wrapRef, setOpen);

  const addArea = (area: AreaCompania) => {
    if (values.includes(area) || area === excludeArea) return;
    onChange?.([...values, area]);
    setOpen(false);
  };

  const removeArea = (area: AreaCompania) => {
    onChange?.(values.filter((item) => item !== area));
  };

  return (
    <div className={styles.secondaryAreas}>
      <div
        className={`${styles.secondaryAreaBox} ${values.length === 0 ? styles.secondaryAreaBoxEmpty : ''}`}
      >
        {values.length > 0 ? (
          <ul className={styles.secondaryAreaChips} aria-label="Áreas secundarias seleccionadas">
            {values.map((area) => (
              <li key={area}>
                <span className={styles.secondaryAreaChip} data-area={area}>
                  <span className={styles.secondaryAreaChipLabel}>{area}</span>
                  <button
                    type="button"
                    className={styles.secondaryAreaChipRemove}
                    onClick={() => removeArea(area)}
                    disabled={disabled}
                    aria-label={`Quitar área ${area}`}
                    title={`Quitar ${area}`}
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <span className={styles.secondaryAreaEmptyText}>Ninguna aún</span>
        )}

        <div ref={wrapRef} className={`${styles.areaSelectWrap} ${styles.secondaryAreaAddWrap}`}>
          <button
            type="button"
            className={styles.secondaryAreaAddButton}
            aria-labelledby={labelId}
            aria-describedby={hintId}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listboxId}
            disabled={disabled || available.length === 0}
            onClick={() => setOpen((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (available.length > 0) setOpen(true);
              }
            }}
          >
            <span aria-hidden>+</span>
            <span>{available.length === 0 ? 'Sin más' : 'Añadir'}</span>
          </button>
          {open && available.length > 0 ? (
            <div id={listboxId} className={styles.areaSelectPopover} role="listbox" aria-labelledby={labelId}>
              {available.map((area) => (
                <button
                  key={area}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className={styles.areaSelectOption}
                  data-area={area}
                  onClick={() => addArea(area)}
                >
                  {area}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ExtractionResultCard({
  result,
  rawClaudeJson,
  onAreaChange,
  secondaryAreas = [],
  onSecondaryAreasChange,
}: {
  result: ClaudeOfferExtraction | null;
  rawClaudeJson: string;
  /** Permite corregir el área detectada si el escaneo falla. */
  onAreaChange?: (area: AreaCompania | null) => void;
  /** Áreas adicionales participantes (aún no enviadas a Yubiq). */
  secondaryAreas?: AreaCompania[];
  onSecondaryAreasChange?: (areas: AreaCompania[]) => void;
}) {
  if (!result) return null;

  const areaValue = result.areaCompania ?? '';

  return (
    <>
      <div className={styles.grid} aria-label="Campos extraídos">
        <div className={styles.identityRow}>
          <div className={styles.field}>
            <p className={styles.label}>Título</p>
            <p className={styles.value}>{valueOrDash(result.titulo)}</p>
          </div>
          <div className={styles.field}>
            <p className={styles.label}>Cliente</p>
            <p className={`${styles.value} ${styles.valueStrong}`}>{valueOrDash(result.nombreCliente)}</p>
          </div>
        </div>

        <div className={`${styles.field} ${styles.fieldWide} ${styles.fieldMetric}`}>
          <div className={styles.importeMargenHead}>
            <div className={styles.importeHeadLeft}>
              <p className={styles.label}>Importe</p>
              {result.notaMultiplesOpcionesPrecio ? (
                <details className={styles.importeAvisoOpciones}>
                  <summary
                    className={styles.importeAvisoOpcionesSummary}
                    aria-label="Múltiples importes. Desplegar para ver el detalle."
                  >
                    <WarningIcon className={styles.importeAvisoOpcionesIcon} />
                    <span className={styles.importeAvisoOpcionesTitle}>Múltiples importes</span>
                    {result.numeroOpcionesPrecioEstimado != null && result.numeroOpcionesPrecioEstimado >= 2 ? (
                      <span className={styles.importeAvisoOpcionesMetaInline}>
                        ~{result.numeroOpcionesPrecioEstimado}
                      </span>
                    ) : null}
                    <ChevronIcon className={styles.importeAvisoOpcionesChevron} />
                  </summary>
                  <div className={styles.importeAvisoOpcionesExpanded}>
                    <p className={styles.importeAvisoOpcionesText}>{result.notaMultiplesOpcionesPrecio}</p>
                  </div>
                </details>
              ) : null}
            </div>
          </div>

          <ImporteOfertaValue text={result.importeOferta} />

          <div className={styles.importeSummary}>
            {result.importeTotalConCompromisoTexto ? (
              <div className={styles.importeSummaryMain} role="group" aria-label="Total importe comprometido">
                <span className={styles.importeSummaryLabel}>Total comprometido</span>
                <span className={styles.importeSummaryValueRow}>
                  <span className={styles.importeSummaryValue}>{result.importeTotalConCompromisoTexto}</span>
                  {result.notaImporteCompromiso ? (
                    <CompromisoInfoTooltip text={result.notaImporteCompromiso} />
                  ) : null}
                </span>
              </div>
            ) : null}
            {result.importeTotalDealComputablesTexto && !result.importeTotalConCompromisoTexto ? (
              <div className={styles.importeSummaryMain} role="group" aria-label="Total importe computable">
                <span className={styles.importeSummaryLabel}>Total computable</span>
                <span className={styles.importeSummaryValueRow}>
                  <span className={styles.importeSummaryValue}>{result.importeTotalDealComputablesTexto}</span>
                  {result.notaImporteTotalDealComputables ? (
                    <CompromisoInfoTooltip text={result.notaImporteTotalDealComputables} />
                  ) : null}
                </span>
              </div>
            ) : null}
            <div
              className={`${styles.margenBadge} ${
                !result.importeTotalConCompromisoTexto && !result.importeTotalDealComputablesTexto
                  ? styles.margenBadgeSolo
                  : ''
              }`}
              aria-label={`Margen ${marginOrDash(result.margenPorcentaje)}`}
            >
              <span className={styles.margenBadgeLabel}>Margen</span>
              <span className={styles.margenBadgeValue}>{marginOrDash(result.margenPorcentaje)}</span>
            </div>
          </div>

          {result.notaImporteCompromiso && !result.importeTotalConCompromisoTexto ? (
            <p className={styles.importeNota}>{result.notaImporteCompromiso}</p>
          ) : null}
          {result.notaImporteTotalDealComputables &&
          !result.importeTotalDealComputablesTexto &&
          !result.importeTotalConCompromisoTexto ? (
            <p className={styles.importeNota}>{result.notaImporteTotalDealComputables}</p>
          ) : null}
          {result.notaInterpretacionImporte ? (
            <p className={styles.importeNota}>{result.notaInterpretacionImporte}</p>
          ) : null}
        </div>

        <div className={styles.areasRow}>
          <div className={styles.field}>
            <p className={styles.label} id="extraction-area-label">
              Área principal
            </p>
            <AreaDropdown
              value={areaValue}
              labelId="extraction-area-label"
              hintId="extraction-area-hint"
              disabled={!onAreaChange}
              onChange={onAreaChange}
            />
            <p id="extraction-area-hint" className={styles.areaHint}>
              Corrige si el análisis no acierta.
            </p>
          </div>
          <div className={styles.field}>
            <div className={styles.secondaryAreaLabelRow}>
              <p className={styles.label} id="extraction-secondary-areas-label">
                Áreas secundarias
              </p>
              {secondaryAreas.length > 0 ? (
                <span className={styles.secondaryAreaCount}>{secondaryAreas.length}</span>
              ) : null}
            </div>
            <SecondaryAreasPicker
              values={secondaryAreas}
              excludeArea={result.areaCompania}
              labelId="extraction-secondary-areas-label"
              hintId="extraction-secondary-areas-hint"
              disabled={!onSecondaryAreasChange}
              onChange={onSecondaryAreasChange}
            />
            <p id="extraction-secondary-areas-hint" className={styles.areaHint}>
              Opcional
            </p>
          </div>
        </div>

        <div className={`${styles.field} ${styles.fieldWide} ${styles.fieldText}`}>
          <p className={styles.label}>Resumen</p>
          <p className={styles.value}>{valueOrDash(result.resumen)}</p>
        </div>
        <div className={`${styles.field} ${styles.fieldWide} ${styles.fieldText}`}>
          <p className={styles.label}>Observaciones</p>
          <p className={styles.value}>{valueOrDash(result.observaciones)}</p>
        </div>
      </div>

      <details className={styles.raw}>
        <summary className={styles.rawSummary}>
          <span className={styles.rawSummaryText}>
            <span className={styles.rawSummaryTitle}>JSON RAW</span>
            <span className={styles.rawSummaryHint}>Respuesta de Claude</span>
          </span>
          <ChevronIcon className={styles.rawSummaryChevron} />
        </summary>
        <pre className={styles.rawPre} aria-label="JSON RAW generado por Claude">
          {rawClaudeJson}
        </pre>
      </details>
    </>
  );
}

