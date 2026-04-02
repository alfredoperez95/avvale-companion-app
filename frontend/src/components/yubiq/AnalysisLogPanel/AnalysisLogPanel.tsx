'use client';

import styles from './AnalysisLogPanel.module.css';

type Phase = 'idle' | 'uploading' | 'extracting' | 'analyzing' | 'done' | 'error';

export function AnalysisLogPanel({
  log,
  phase = 'idle',
}: {
  log: string[];
  phase?: Phase;
}) {
  const emptyHint =
    phase === 'analyzing' || phase === 'uploading'
      ? 'Iniciando pasos…'
      : 'Aún no hay pasos. Sube un PDF y pulsa «Analizar PDF» para ver el progreso aquí.';

  return (
    <div className={styles.console} aria-label="Log de ejecución">
      <div className={styles.consoleChrome} aria-hidden>
        <span className={styles.consoleDots}>
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
        </span>
        <span className={styles.consoleTitle}>stdout — pipeline</span>
        <span className={styles.consoleBadge}>bash</span>
      </div>
      <div className={styles.consoleBody}>
        {!log.length ? (
          <div className={styles.emptyLine} role="status">
            <span className={styles.lineNo}>··</span>
            <span className={styles.prompt} aria-hidden>
              $
            </span>
            <span className={styles.emptyHint}>{emptyHint}</span>
          </div>
        ) : (
          log.map((line, i) => (
            <div key={i} className={styles.consoleLine}>
              <span className={styles.lineNo}>{String(i + 1).padStart(2, '0')}</span>
              <span className={styles.prompt} aria-hidden>
                ›
              </span>
              <span className={styles.lineText}>{line}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
