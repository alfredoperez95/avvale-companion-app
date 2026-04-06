'use client';

import { Fragment, type ReactNode } from 'react';
import styles from './rfq-analysis.module.css';

/** Quita emojis y símbolos pictográficos del texto del asistente. */
function stripEmojis(s: string): string {
  try {
    return s
      .replace(/\p{Extended_Pictographic}/gu, '')
      .replace(/\uFE0F/g, '')
      .replace(/\u200D/g, '');
  } catch {
    return s;
  }
}

/** Normaliza títulos que vienen con ** del modelo. */
function cleanHeadingText(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*\*/g, '').trim();
}

/** El modelo a veces envía entidades HTML escapadas en texto plano. */
function decodeBasicHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

/** Línea de encabezado markdown (# … ####). */
function isMarkdownHeadingLine(nt: string): boolean {
  return /^#{1,5}\s/.test(nt);
}

/** Diagramas caja (┌├│), Gantt (█), timelines tipo "Semana / FASE". */
function isAsciiDiagramOrGantt(body: string): boolean {
  const sample = body.slice(0, 14000);
  if (/[┌├└│┤┬┴┼═╴╵╶╷─━]/.test(sample)) return true;
  if (/█/.test(sample) && /[─┼┤]/.test(sample)) return true;
  if ((sample.match(/█/g) || []).length >= 4) return true;
  if (/^\s*(Semana|FASE\s*\d)/im.test(sample) && /█/.test(sample)) return true;
  if (/FASE\s*\d+\s*:/i.test(sample) && /├|└|─/.test(sample)) return true;
  return false;
}

/** Barras de tiempo compactas (muchas columnas numéricas + bloques █). */
function isGanttTimelineStyle(body: string): boolean {
  return (
    /█{4,}/.test(body) ||
    (/Semana/i.test(body) && /\b\d{1,2}\s+\d{1,2}\s+\d{1,2}/.test(body)) ||
    (/^\s*Semana\s+/im.test(body) && /─{8,}/.test(body))
  );
}

/** Renderiza **negritas** en una línea de texto plano. */
function InlineText({ text }: { text: string }): ReactNode {
  const parts: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  const s = decodeBasicHtmlEntities(text);
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) {
      parts.push(s.slice(last, m.index));
    }
    parts.push(
      <strong key={k++} className={styles.chatMdStrong}>
        {m[1]}
      </strong>,
    );
    last = m.index + m[0].length;
  }
  if (last < s.length) {
    parts.push(s.slice(last));
  }
  return parts.length ? <>{parts}</> : s;
}

type TableParsed = { headers: string[]; rows: string[][] };

function rowCells(line: string): string[] | null {
  const t = line.trim();
  if (!t.includes('|')) return null;
  const parts = t.split('|').map((c) => c.trim());
  const inner = parts.filter((c, i) => !(c === '' && (i === 0 || i === parts.length - 1)));
  return inner.length >= 2 ? inner : null;
}

function parseTableLines(lines: string[]): TableParsed | null {
  if (lines.length < 1) return null;
  const first = rowCells(lines[0]!);
  if (!first) return null;
  let idx = 1;
  if (
    lines.length > 1 &&
    /^\s*\|?[\s\-:| ]+\|[\s\-:| ]+\|?\s*$/.test(lines[1]!.trim())
  ) {
    idx = 2;
  }
  const rows: string[][] = [];
  for (; idx < lines.length; idx++) {
    const r = rowCells(lines[idx]!);
    if (r && r.length) rows.push(r);
  }
  return { headers: first, rows };
}

type Segment =
  | { type: 'h3'; text: string }
  | { type: 'h4'; text: string }
  | { type: 'h5'; text: string }
  | { type: 'h6'; text: string }
  | { type: 'code'; lang?: string; body: string }
  | { type: 'p'; lines: string[] }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'blockquote'; lines: string[] }
  | { type: 'hr' };

function parseChatMarkdown(raw: string): Segment[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const segments: Segment[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';
    const t = line.trim();
    if (t === '') {
      i++;
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(t)) {
      segments.push({ type: 'hr' });
      i++;
      continue;
    }

    if (t.startsWith('```')) {
      const fence = t.match(/^```([\w.\-+]*)\s*$/);
      if (fence) {
        const lang = fence[1]?.trim() || undefined;
        const codeLines: string[] = [];
        i++;
        while (i < lines.length) {
          const L = lines[i]!;
          if (L.trim() === '```') break;
          codeLines.push(L);
          i++;
        }
        if (i < lines.length) i++;
        segments.push({ type: 'code', lang, body: codeLines.join('\n') });
        continue;
      }
    }

    if (t.startsWith('##### ')) {
      segments.push({ type: 'h6', text: t.slice(6) });
      i++;
      continue;
    }
    if (t.startsWith('#### ')) {
      segments.push({ type: 'h6', text: t.slice(5) });
      i++;
      continue;
    }
    if (t.startsWith('### ')) {
      segments.push({ type: 'h5', text: t.slice(4) });
      i++;
      continue;
    }
    if (t.startsWith('## ')) {
      segments.push({ type: 'h4', text: t.slice(3) });
      i++;
      continue;
    }
    if (t.startsWith('# ') && !t.startsWith('##')) {
      segments.push({ type: 'h3', text: t.slice(2) });
      i++;
      continue;
    }

    if (t.startsWith('>')) {
      const q: string[] = [];
      while (i < lines.length) {
        const L = lines[i]!.trim();
        if (L === '') break;
        if (!L.startsWith('>')) break;
        if (L.startsWith('```') || isMarkdownHeadingLine(L)) break;
        q.push(L.replace(/^>\s?/, '').trim());
        i++;
      }
      segments.push({ type: 'blockquote', lines: q });
      continue;
    }

    if (t.includes('|') && t.split('|').filter((x) => x.trim() !== '').length >= 2) {
      const tableLines: string[] = [];
      while (i < lines.length) {
        const L = lines[i]!;
        const Lt = L.trim();
        if (Lt === '') break;
        if (Lt.startsWith('```') || isMarkdownHeadingLine(Lt)) break;
        if (!L.includes('|')) break;
        tableLines.push(L);
        i++;
      }
      const tbl = parseTableLines(tableLines);
      if (tbl) {
        segments.push({ type: 'table', headers: tbl.headers, rows: tbl.rows });
      }
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\s*[-*]\s+/, '').trim());
        i++;
      }
      segments.push({ type: 'ul', items });
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\s*\d+\.\s+/, '').trim());
        i++;
      }
      segments.push({ type: 'ol', items });
      continue;
    }

    const para: string[] = [line];
    i++;
    while (i < lines.length) {
      const next = lines[i]!;
      const nt = next.trim();
      if (nt === '') break;
      if (nt.startsWith('```')) break;
      if (isMarkdownHeadingLine(nt)) break;
      if (/^(-{3,}|\*{3,})$/.test(nt)) break;
      if (next.trim().startsWith('>')) break;
      if (/^\s*[-*]\s+/.test(next)) break;
      if (/^\s*\d+\.\s+/.test(next)) break;
      if (nt.includes('|')) {
        const parts = nt.split('|').map((x) => x.trim()).filter((x) => x !== '');
        if (parts.length >= 2) break;
      }
      para.push(next);
      i++;
    }
    segments.push({ type: 'p', lines: para });
  }

  return segments;
}

function padRow(cells: string[], n: number): string[] {
  const o = [...cells];
  while (o.length < n) o.push('');
  return o.slice(0, n);
}

function SegmentView({ seg }: { seg: Segment }) {
  switch (seg.type) {
    case 'hr':
      return <hr className={styles.chatMdHr} />;
    case 'h3':
      return (
        <h3 className={styles.chatMdH3}>
          <InlineText text={cleanHeadingText(seg.text)} />
        </h3>
      );
    case 'h4':
      return (
        <h4 className={styles.chatMdH4}>
          <InlineText text={cleanHeadingText(seg.text)} />
        </h4>
      );
    case 'h5':
      return (
        <h5 className={styles.chatMdH5}>
          <InlineText text={cleanHeadingText(seg.text)} />
        </h5>
      );
    case 'h6':
      return (
        <h6 className={styles.chatMdH6}>
          <InlineText text={cleanHeadingText(seg.text)} />
        </h6>
      );
    case 'code': {
      const diagram = isAsciiDiagramOrGantt(seg.body);
      const gantt = diagram && isGanttTimelineStyle(seg.body);
      const label = seg.lang
        ? seg.lang
        : diagram
          ? gantt
            ? 'Gantt / planificación'
            : 'Diagrama ASCII'
          : null;
      const preClass = [
        styles.chatMdPre,
        diagram ? styles.chatMdPreDiagram : '',
        gantt ? styles.chatMdPreGantt : '',
      ]
        .filter(Boolean)
        .join(' ');
      const wrapClass = [styles.chatMdCodeBlock, diagram ? styles.chatMdCodeBlockDiagram : '']
        .filter(Boolean)
        .join(' ');
      return (
        <div className={wrapClass}>
          {label ? (
            <div className={styles.chatMdCodeLang} aria-hidden>
              {label}
            </div>
          ) : null}
          <pre
            className={preClass}
            tabIndex={diagram ? 0 : undefined}
            role={diagram ? 'region' : undefined}
            aria-label={diagram ? 'Diagrama o planificación en texto' : undefined}
          >
            <code>{decodeBasicHtmlEntities(seg.body)}</code>
          </pre>
        </div>
      );
    }
    case 'p':
      return (
        <p className={styles.chatMdP}>
          {seg.lines.map((ln, j) => (
            <Fragment key={j}>
              {j > 0 ? <br /> : null}
              <InlineText text={ln.trim()} />
            </Fragment>
          ))}
        </p>
      );
    case 'ul':
      return (
        <ul className={styles.chatMdUl}>
          {seg.items.map((item, j) => (
            <li key={j} className={styles.chatMdLi}>
              <InlineText text={item} />
            </li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol className={styles.chatMdOl}>
          {seg.items.map((item, j) => (
            <li key={j} className={styles.chatMdLi}>
              <InlineText text={item} />
            </li>
          ))}
        </ol>
      );
    case 'blockquote':
      return (
        <blockquote className={styles.chatMdBlockquote}>
          {seg.lines.map((ln, j) => (
            <p key={j} className={styles.chatMdBlockquoteP}>
              <InlineText text={ln} />
            </p>
          ))}
        </blockquote>
      );
    case 'table': {
      const ncol = Math.max(
        seg.headers.length,
        1,
        ...seg.rows.map((r) => r.length),
      );
      const heads = padRow(seg.headers, ncol);
      return (
        <div className={styles.chatMdTableWrap}>
          <table className={styles.chatMdTable}>
            <thead>
              <tr>
                {heads.map((h, j) => (
                  <th key={j} className={styles.chatMdTh}>
                    {h ? <InlineText text={h} /> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {seg.rows.map((row, ri) => (
                <tr key={ri}>
                  {padRow(row, ncol).map((cell, ci) => (
                    <td key={ci} className={styles.chatMdTd}>
                      {cell ? <InlineText text={cell} /> : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    default:
      return null;
  }
}

export function RfqAssistantMessageBody({ text }: { text: string }) {
  const cleaned = stripEmojis(text);
  const segments = parseChatMarkdown(cleaned);
  return (
    <div className={styles.chatAssistantBody}>
      {segments.map((seg, i) => (
        <SegmentView key={i} seg={seg} />
      ))}
    </div>
  );
}
