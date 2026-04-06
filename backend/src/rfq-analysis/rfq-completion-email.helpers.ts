import { RfqSourceKind } from '@prisma/client';

export type RfqEmailSourceRow = {
  /** Nombre del archivo o etiqueta de fuente (sin prefijo "Archivo:"). */
  title: string;
  /** Formato a mostrar a la derecha (PDF, Excel, …); null para email/hilo/nota. */
  formatTag: string | null;
};

/** Misma lógica que la columna Tipo en la UI (PDF, Excel, Word, …). */
export function fileFormatLabelForEmail(mimeType: string | null, fileName: string | null): string {
  const mt = (mimeType ?? '').toLowerCase().trim();
  if (mt === 'application/pdf' || mt.includes('pdf')) return 'PDF';
  if (
    mt === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mt === 'application/vnd.ms-excel' ||
    mt.includes('spreadsheet')
  ) {
    return 'Excel';
  }
  if (
    mt === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mt === 'application/msword' ||
    mt.includes('wordprocessing')
  ) {
    return 'Word';
  }
  if (
    mt === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    mt === 'application/vnd.ms-powerpoint' ||
    mt.includes('presentation') ||
    mt.includes('powerpoint')
  ) {
    return 'PowerPoint';
  }
  if (mt.startsWith('image/')) {
    if (mt.includes('png')) return 'Imagen (PNG)';
    if (mt.includes('jpeg') || mt.includes('jpg')) return 'Imagen (JPEG)';
    if (mt.includes('gif')) return 'Imagen (GIF)';
    if (mt.includes('webp')) return 'Imagen (WebP)';
    if (mt.includes('svg')) return 'Imagen (SVG)';
    return 'Imagen';
  }
  if (mt === 'text/csv' || mt.includes('csv')) return 'CSV';
  if (mt === 'text/plain' || (mt.startsWith('text/') && !mt.includes('html'))) return 'Texto';
  if (mt.includes('json')) return 'JSON';
  if (mt.includes('xml')) return 'XML';
  if (mt.includes('zip') || mt.includes('compressed')) return 'ZIP';

  const base = (fileName ?? '').toLowerCase().trim();
  const dot = base.lastIndexOf('.');
  const ext = dot >= 0 ? base.slice(dot) : '';
  const byExt: Record<string, string> = {
    '.pdf': 'PDF',
    '.xlsx': 'Excel',
    '.xls': 'Excel',
    '.xlsm': 'Excel',
    '.csv': 'CSV',
    '.docx': 'Word',
    '.doc': 'Word',
    '.pptx': 'PowerPoint',
    '.ppt': 'PowerPoint',
    '.png': 'Imagen (PNG)',
    '.jpg': 'Imagen (JPEG)',
    '.jpeg': 'Imagen (JPEG)',
    '.gif': 'Imagen (GIF)',
    '.webp': 'Imagen (WebP)',
    '.svg': 'Imagen (SVG)',
    '.txt': 'Texto',
    '.json': 'JSON',
    '.xml': 'XML',
    '.zip': 'ZIP',
  };
  if (ext && byExt[ext]) return byExt[ext];

  return 'Archivo';
}

/** Filas para la plantilla de correo: nombre a la izquierda, formato a la derecha (solo archivos). */
export function buildRfqEmailSourceRows(
  sources: { kind: RfqSourceKind; fileName: string | null; mimeType?: string | null }[],
): RfqEmailSourceRow[] {
  return sources.map((s) => {
    if (s.kind === RfqSourceKind.FILE) {
      const title = (s.fileName?.trim() || 'sin nombre').trim();
      return {
        title,
        formatTag: fileFormatLabelForEmail(s.mimeType ?? null, s.fileName),
      };
    }
    if (s.kind === RfqSourceKind.EMAIL_BODY) {
      return { title: 'Cuerpo del email', formatTag: null };
    }
    if (s.kind === RfqSourceKind.THREAD_CONTEXT) {
      return { title: 'Contexto del hilo de correo', formatTag: null };
    }
    return { title: 'Nota manual', formatTag: null };
  });
}
