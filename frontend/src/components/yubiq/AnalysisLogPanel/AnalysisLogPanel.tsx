'use client';

import { useEffect, useRef } from 'react';
import styles from './AnalysisLogPanel.module.css';

type Phase = 'idle' | 'uploading' | 'extracting' | 'analyzing' | 'done' | 'error';

export function AnalysisLogPanel({
  log,
  phase = 'idle',
}: {
  log: string[];
  phase?: Phase;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const busy = phase === 'uploading' || phase === 'extracting' || phase === 'analyzing';

  useEffect(() => {
    const el = bodyRef.current;
    if (!el || !log.length) return;
    el.scrollTop = el.scrollHeight;
  }, [log]);

  const emptyHint =
    phase === 'analyzing' || phase === 'uploading' || phase === 'extracting'
      ? 'Ejecutando pipeline…'
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
        <span className={`${styles.consoleBadge} ${busy ? styles.consoleBadgeLive : ''}`}>
          {busy ? 'live' : 'bash'}
        </span>
      </div>
      <div ref={bodyRef} className={styles.consoleBody}>
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
        {busy ? (
          <div className={styles.consoleLine} aria-hidden>
            <span className={styles.lineNo}>··</span>
            <span className={styles.prompt}>›</span>
            <span className={styles.cursorBlink} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
