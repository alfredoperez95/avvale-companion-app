import { RfqSourceKind } from '@prisma/client';

/** Misma redacción que en el pipeline y en el correo de completado. */
export function formatRfqSourceLinesForEmail(
  sources: { kind: RfqSourceKind; fileName: string | null }[],
): string[] {
  return sources.map((s) => {
    if (s.kind === RfqSourceKind.FILE) {
      return `Archivo: ${s.fileName ?? 'sin nombre'}`;
    }
    if (s.kind === RfqSourceKind.EMAIL_BODY) return 'Cuerpo del email';
    if (s.kind === RfqSourceKind.THREAD_CONTEXT) return 'Contexto del hilo';
    return 'Nota manual';
  });
}
