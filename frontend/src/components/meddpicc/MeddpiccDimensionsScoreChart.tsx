'use client';

import { useId, useMemo, useState } from 'react';
import type { MeddpiccDimensionDef } from '@/lib/meddpicc-dimensions';
import { MEDDPICC_DIMENSIONS } from '@/lib/meddpicc-dimensions';
import styles from './MeddpiccDimensionsScoreChart.module.css';

function guideLineForScore(dim: MeddpiccDimensionDef, score: number): string {
  const keys = Object.keys(dim.scoreGuide)
    .map(Number)
    .filter((k) => Number.isFinite(k))
    .sort((a, b) => a - b);
  if (!keys.length) return '';
  let best = keys[0];
  for (const k of keys) {
    if (score >= k) best = k;
    else break;
  }
  return dim.scoreGuide[best] ?? '';
}

function clampScore(raw: unknown): number {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
  return Math.min(10, Math.max(0, n));
}

type Props = {
  scores: Record<string, number>;
};

type ViewMode = 'bars' | 'radar';

const RADAR_VB = 100;
const RADAR_CX = 50;
const RADAR_CY = 50;
const RADAR_R = 36;
const RADAR_R_LABEL = 44;

function vertexAngle(index: number, n: number): number {
  return Math.PI / 2 - (2 * Math.PI * index) / n;
}

function radarPoint(score: number, index: number, n: number): { x: number; y: number } {
  const t = clampScore(score) / 10;
  const a = vertexAngle(index, n);
  return {
    x: RADAR_CX + RADAR_R * t * Math.cos(a),
    y: RADAR_CY - RADAR_R * t * Math.sin(a),
  };
}

function ringPolygonPath(fraction: number, n: number): string {
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = vertexAngle(i, n);
    const r = RADAR_R * fraction;
    const x = RADAR_CX + r * Math.cos(a);
    const y = RADAR_CY - r * Math.sin(a);
    pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(3)} ${y.toFixed(3)}`);
  }
  return `${pts.join(' ')} Z`;
}

function axisLine(index: number, n: number): { x1: number; y1: number; x2: number; y2: number } {
  const a = vertexAngle(index, n);
  return {
    x1: RADAR_CX,
    y1: RADAR_CY,
    x2: RADAR_CX + RADAR_R * Math.cos(a),
    y2: RADAR_CY - RADAR_R * Math.sin(a),
  };
}

function MeddpiccRadarChart({ scores }: { scores: Record<string, number> }) {
  const titleId = useId();
  const n = MEDDPICC_DIMENSIONS.length;

  const { dataPath, points, summary } = useMemo(() => {
    const pts = MEDDPICC_DIMENSIONS.map((dim, i) => {
      const v = clampScore(scores[dim.key]);
      const p = radarPoint(v, i, n);
      return { dim, v, ...p };
    });
    const d =
      pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(3)} ${p.y.toFixed(3)}`).join(' ') + ' Z';
    const parts = pts.map((p) => `${p.dim.key} ${p.v}/10`);
    const summaryText = `Puntuaciones por dimensión: ${parts.join(', ')}. Escala 0 a 10.`;
    return { dataPath: d, points: pts, summary: summaryText };
  }, [scores]);

  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <div className={styles.radarWrap}>
      <svg
        className={styles.radarSvg}
        viewBox={`0 0 ${RADAR_VB} ${RADAR_VB}`}
        role="img"
        aria-labelledby={titleId}
      >
        <title id={titleId}>{summary}</title>
        {rings.map((f) => (
          <path
            key={f}
            className={styles.radarRing}
            d={ringPolygonPath(f, n)}
            fill="none"
          />
        ))}
        {MEDDPICC_DIMENSIONS.map((_, i) => {
          const { x1, y1, x2, y2 } = axisLine(i, n);
          return (
            <line
              key={i}
              className={styles.radarAxis}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
            />
          );
        })}
        <path className={styles.radarArea} d={dataPath} />
        <path className={styles.radarOutline} d={dataPath} fill="none" />
        {points.map((p) => (
          <circle
            key={p.dim.key}
            className={styles.radarDot}
            cx={p.x}
            cy={p.y}
            r={1.35}
            fill={p.dim.color}
            stroke="var(--fiori-surface)"
            strokeWidth={0.45}
          >
            <title>{`${p.dim.name}: ${p.v}/10`}</title>
          </circle>
        ))}
        {MEDDPICC_DIMENSIONS.map((dim, i) => {
          const a = vertexAngle(i, n);
          const lx = RADAR_CX + RADAR_R_LABEL * Math.cos(a);
          const ly = RADAR_CY - RADAR_R_LABEL * Math.sin(a);
          return (
            <text
              key={dim.key}
              className={styles.radarLabel}
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {dim.key}
            </text>
          );
        })}
      </svg>
      <p className={styles.radarHint}>
        Octágono con una arista por dimensión MEDDPICC; la distancia al centro es el score (0 en el centro, 10 en el borde).
      </p>
    </div>
  );
}

export function MeddpiccDimensionsScoreChart({ scores }: Props) {
  const [view, setView] = useState<ViewMode>('bars');

  const sectionLabel =
    view === 'bars'
      ? 'Gráfico de puntuación MEDDPICC por dimensión, escala 0 a 10, vista de barras'
      : 'Gráfico de puntuación MEDDPICC por dimensión, escala 0 a 10, vista mapa radial';

  return (
    <section className={styles.wrap} aria-label={sectionLabel}>
      <header className={styles.head}>
        <div className={styles.titleBlock}>
          <h3 className={styles.title}>Puntuación por dimensión</h3>
          <p className={styles.subtitle}>
            {view === 'bars'
              ? 'Barras según el score actual (0–10). Pasa el cursor por cada fila para ver la descripción y la referencia de la escala.'
              : 'Mapa radial (octágono): cada vértice es una dimensión; el área muestra el equilibrio del deal. Pasa el cursor por los puntos para ver el score.'}
          </p>
        </div>
        <div className={styles.viewToggle} role="group" aria-label="Tipo de visualización">
          <button
            type="button"
            className={view === 'bars' ? `${styles.viewBtn} ${styles.viewBtnActive}` : styles.viewBtn}
            onClick={() => setView('bars')}
            aria-pressed={view === 'bars'}
          >
            Barras
          </button>
          <button
            type="button"
            className={view === 'radar' ? `${styles.viewBtn} ${styles.viewBtnActive}` : styles.viewBtn}
            onClick={() => setView('radar')}
            aria-pressed={view === 'radar'}
            title="Mapa de posicionamiento tipo radar (octágono MEDDPICC)"
          >
            Mapa radial
          </button>
        </div>
      </header>

      {view === 'bars' ? (
        <div className={styles.grid}>
          {MEDDPICC_DIMENSIONS.map((dim) => {
            const raw = scores[dim.key];
            const v = clampScore(raw);
            const pct = v * 10;
            const guide = guideLineForScore(dim, v);
            const tipId = `score-tip-${dim.key}`;
            return (
              <div
                key={dim.key}
                className={styles.row}
                tabIndex={0}
                aria-describedby={tipId}
              >
                <span className={styles.key} title={dim.name}>
                  {dim.key}
                </span>
                <div className={styles.track} aria-hidden>
                  <div className={styles.bar} style={{ width: `${pct}%`, backgroundColor: dim.color }} />
                </div>
                <span className={styles.val}>{v}</span>
                <div id={tipId} className={styles.tooltip} role="tooltip">
                  <p className={styles.tooltipName} style={{ color: dim.color }}>
                    {dim.name}
                  </p>
                  <p className={styles.tooltipScore}>
                    Score actual: <strong>{v}/10</strong>
                  </p>
                  <p className={styles.tooltipDesc}>{dim.description}</p>
                  {guide ? (
                    <p className={styles.tooltipGuide}>
                      <strong>Escala de la dimensión</strong>: {guide}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <MeddpiccRadarChart scores={scores} />
      )}
    </section>
  );
}
