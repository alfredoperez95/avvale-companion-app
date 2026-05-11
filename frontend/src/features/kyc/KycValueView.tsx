'use client';

import styles from './kyc-workspace.module.css';

function prettyLabel(k: string) {
  return String(k).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export function KycValueView({ v }: { v: unknown }) {
  if (v === null || v === undefined || v === '') {
    return <span className={styles.kycValueMuted}>—</span>;
  }
  if (Array.isArray(v)) {
    if (!v.length) return <span className={styles.kycValueMuted}>—</span>;
    return (
      <div className={styles.kycValueChips}>
        {v.map((x, i) => {
          const s = typeof x === 'object' ? JSON.stringify(x) : String(x);
          return (
            <span key={i} className={styles.kycValueChip}>
              {esc(s)}
            </span>
          );
        })}
      </div>
    );
  }
  if (typeof v === 'object') {
    return (
      <div className={styles.kycValueNested}>
        {Object.entries(v as object).map(([k, val]) => (
          <div key={k} className={styles.kycValueRow}>
            <span className={styles.kycValueKey}>{esc(prettyLabel(k))}:</span>{' '}
            <KycValueView v={val} />
          </div>
        ))}
      </div>
    );
  }
  return <span className={styles.kycValueString}>{esc(String(v))}</span>;
}
