'use client';

function prettyLabel(k: string) {
  return String(k).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export function KycValueView({ v }: { v: unknown }) {
  if (v === null || v === undefined || v === '') {
    return <span style={{ color: '#cbd5e1' }}>—</span>;
  }
  if (Array.isArray(v)) {
    if (!v.length) return <span style={{ color: '#cbd5e1' }}>—</span>;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
        {v.map((x, i) => {
          const s = typeof x === 'object' ? JSON.stringify(x) : String(x);
          return (
            <span
              key={i}
              style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: 999, background: '#f1f5f9', border: '1px solid #e2e8f0' }}
            >
              {esc(s)}
            </span>
          );
        })}
      </div>
    );
  }
  if (typeof v === 'object') {
    return (
      <div style={{ borderLeft: '2px solid #f1f5f9', paddingLeft: '0.5rem', marginTop: '0.15rem' }}>
        {Object.entries(v as object).map(([k, val]) => (
          <div key={k} style={{ fontSize: '0.75rem', marginBottom: '0.2rem' }}>
            <span style={{ color: '#94a3b8' }}>{esc(prettyLabel(k))}:</span> <KycValueView v={val} />
          </div>
        ))}
      </div>
    );
  }
  return <span style={{ color: '#0f172a' }}>{esc(String(v))}</span>;
}
