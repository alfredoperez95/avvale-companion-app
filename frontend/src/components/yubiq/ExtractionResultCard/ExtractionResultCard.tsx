'use client';

/** Reglas de negocio (UI oferta): docs/YUBIQ_OFERTA_REGLAS.md */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CssStyled } from '@/components/CssStyled/CssStyled';
import { ALLOWED_YUBIQ_SEGMENTS } from '@/lib/yubiq';
import type { AreaCompania, ClaudeOfferExtraction } from '@/types/yubiq';
import styles from './ExtractionResultCard.module.css';

const AREA_OPTIONS: readonly AreaCompania[] = ALLOWED_YUBIQ_SEGMENTS;

function valueOrDash(v: string | null | undefined): string {
  const s = (v ?? '').trim();
  return s ? s : '—';
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

export function ExtractionResultCard({
  result,
  rawClaudeJson,
  onAreaChange,
}: {
  result: ClaudeOfferExtraction | null;
  rawClaudeJson: string;
  /** Permite corregir el área detectada si el escaneo falla. */
  onAreaChange?: (area: AreaCompania | null) => void;
}) {
  if (!result) return null;

  const areaValue = result.areaCompania ?? '';

  return (
    <>
      <div className={styles.grid} aria-label="Campos extraídos">
        <div className={styles.card}>
          <p className={styles.label}>Título</p>
          <p className={styles.value}>{valueOrDash(result.titulo)}</p>
        </div>
        <div className={styles.card}>
          <p className={styles.label}>Cliente</p>
          <p className={styles.value}>{valueOrDash(result.nombreCliente)}</p>
        </div>
        <div className={styles.card}>
          <p className={styles.label}>Importe</p>
          {result.notaMultiplesOpcionesPrecio ? (
            <details className={styles.importeAvisoOpciones}>
              <summary
                className={styles.importeAvisoOpcionesSummary}
                aria-label="Múltiples importes. Desplegar para ver la interpretación del importe."
              >
                <WarningIcon className={styles.importeAvisoOpcionesWarningCorner} />
                <div className={styles.importeAvisoOpcionesSummaryInner}>
                  <div className={styles.importeAvisoOpcionesHeadRow}>
                    <div className={styles.importeAvisoOpcionesHeadStack}>
                      <p className={styles.importeAvisoOpcionesHeadline}>
                        <span className={styles.importeAvisoOpcionesTitle}>Múltiples importes</span>
                      </p>
                      {result.numeroOpcionesPrecioEstimado != null && result.numeroOpcionesPrecioEstimado >= 2 ? (
                        <span className={styles.importeAvisoOpcionesMetaInline}>
                          ~{result.numeroOpcionesPrecioEstimado} opciones
                        </span>
                      ) : null}
                    </div>
                    <ChevronIcon className={styles.importeAvisoOpcionesChevron} />
                  </div>
                </div>
              </summary>
              <div className={styles.importeAvisoOpcionesExpanded}>
                <p className={styles.importeAvisoOpcionesText}>{result.notaMultiplesOpcionesPrecio}</p>
              </div>
            </details>
          ) : null}
          <p className={styles.value}>{valueOrDash(result.importeOferta)}</p>
          {result.importeTotalConCompromisoTexto ? (
            <div
              className={styles.importeTotalCompromiso}
              role="group"
              aria-label="Total importe comprometido"
            >
              <span className={styles.importeTotalCompromisoLabel}>Total importe comprometido</span>
              <span className={styles.importeTotalCompromisoValueRow}>
                <span className={styles.importeTotalCompromisoValue}>{result.importeTotalConCompromisoTexto}</span>
                {result.notaImporteCompromiso ? (
                  <CompromisoInfoTooltip text={result.notaImporteCompromiso} />
                ) : null}
              </span>
            </div>
          ) : null}
          {result.importeTotalDealComputablesTexto && !result.importeTotalConCompromisoTexto ? (
            <div
              className={styles.importeTotalCompromiso}
              role="group"
              aria-label="Total importe computable"
            >
              <span className={styles.importeTotalCompromisoLabel}>Total importe computable</span>
              <span className={styles.importeTotalCompromisoValueRow}>
                <span className={styles.importeTotalCompromisoValue}>{result.importeTotalDealComputablesTexto}</span>
                {result.notaImporteTotalDealComputables ? (
                  <CompromisoInfoTooltip text={result.notaImporteTotalDealComputables} />
                ) : null}
              </span>
            </div>
          ) : null}
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
        <div className={styles.card}>
          <p className={styles.label} id="extraction-area-label">
            Área (Avvale)
          </p>
          <div className={styles.areaSelectWrap}>
            <select
              className={styles.areaSelect}
              data-area={areaValue || undefined}
              value={areaValue}
              aria-labelledby="extraction-area-label"
              aria-describedby="extraction-area-hint"
              disabled={!onAreaChange}
              onChange={(e) => {
                if (!onAreaChange) return;
                const next = e.target.value;
                onAreaChange(next === '' ? null : (next as AreaCompania));
              }}
            >
              <option value="">—</option>
              {AREA_OPTIONS.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
            <ChevronIcon className={styles.areaSelectChevron} />
          </div>
          <p id="extraction-area-hint" className={styles.areaHint}>
            Puedes corregirla si el análisis no acierta.
          </p>
        </div>
        <div className={`${styles.card} ${styles.wide}`}>
          <p className={styles.label}>Resumen</p>
          <p className={styles.value}>{valueOrDash(result.resumen)}</p>
        </div>
        <div className={`${styles.card} ${styles.wide}`}>
          <p className={styles.label}>Observaciones</p>
          <p className={styles.value}>{valueOrDash(result.observaciones)}</p>
        </div>
      </div>

      <details className={styles.raw}>
        <summary className={styles.rawSummary}>
          <span className={styles.rawSummaryText}>
            <span className={styles.rawSummaryTitle}>Visualizar JSON RAW generado por Claude</span>
            <span className={styles.rawSummaryHint}>Respuesta del modelo (depuración)</span>
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

