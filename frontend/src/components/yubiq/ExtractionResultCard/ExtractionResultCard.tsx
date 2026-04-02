'use client';

import type { ClaudeOfferExtraction } from '@/types/yubiq';
import styles from './ExtractionResultCard.module.css';

function valueOrDash(v: string | null | undefined): string {
  const s = (v ?? '').trim();
  return s ? s : '—';
}

export function ExtractionResultCard({
  result,
  rawClaudeJson,
}: {
  result: ClaudeOfferExtraction | null;
  rawClaudeJson: string;
}) {
  if (!result) return null;

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
          <p className={styles.value}>{valueOrDash(result.importeOferta)}</p>
        </div>
        <div className={styles.card}>
          <p className={styles.label}>Área (Avvale)</p>
          {result.areaCompania ? (
            <span className={styles.areaBadge} data-area={result.areaCompania}>
              {result.areaCompania}
            </span>
          ) : (
            <p className={styles.value}>—</p>
          )}
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
        <summary className={styles.rawSummary}>Ver JSON crudo devuelto por Claude</summary>
        <pre className={styles.rawPre} aria-label="JSON crudo de Claude">
          {rawClaudeJson}
        </pre>
      </details>
    </>
  );
}

