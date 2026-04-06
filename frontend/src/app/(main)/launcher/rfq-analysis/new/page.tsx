'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch, apiUpload } from '@/lib/api';
import { PageBreadcrumb, PageHero, PageBackLink, ChevronBackIcon } from '@/components/page-hero';
import styles from '../rfq-analysis.module.css';

export default function RfqAnalysisNewPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [manualContext, setManualContext] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError('Indica un título');
      return;
    }
    if (files.length === 0) {
      setError('Adjunta al menos un archivo (la documentación de la oportunidad es obligatoria).');
      return;
    }
    setBusy(true);
    setPhase('Creando análisis…');
    try {
      const createRes = await apiFetch('/api/rfq-analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          manualContext: manualContext.trim() || undefined,
        }),
      });
      if (!createRes.ok) {
        const t = await createRes.text();
        throw new Error(t || 'No se pudo crear el análisis');
      }
      const created = (await createRes.json()) as { id: string };

      if (files.length > 0) {
        setPhase('Subiendo archivos…');
        const fd = new FormData();
        for (const f of files) {
          fd.append('files', f);
        }
        const up = await apiUpload(`/api/rfq-analyses/${created.id}/sources`, fd);
        if (!up.ok) {
          const t = await up.text();
          throw new Error(t || 'Error al subir archivos');
        }
      }

      setPhase('Encolando procesamiento…');
      const proc = await apiFetch(`/api/rfq-analyses/${created.id}/process`, { method: 'POST' });
      if (!proc.ok) {
        const t = await proc.text();
        throw new Error(t || 'No se pudo iniciar el procesamiento');
      }

      router.push(`/launcher/rfq-analysis/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setBusy(false);
      setPhase(null);
    }
  };

  return (
    <main className={styles.page}>
      <PageBreadcrumb>
        <PageBackLink href="/launcher/rfq-analysis">
          <ChevronBackIcon />
          Análisis RFQs
        </PageBackLink>
      </PageBreadcrumb>
      <PageHero
        title="Nuevo análisis"
        subtitle="Define un workspace por oportunidad: luego podrás añadir fuentes, revisar el insight y conversar con el asistente. Si usas un buzón con Make, también puedes crear análisis desde el correo."
        actions={
          <Link href="/launcher/rfq-analysis/email" className={styles.secondaryBtn}>
            Cómo funciona la entrada por email
          </Link>
        }
      />

      {error ? (
        <div className={styles.errorBox} role="alert">
          {error}
        </div>
      ) : null}

      <section className={styles.sectionCard} aria-label="Formulario de nuevo análisis">
        <h2 className={styles.sectionHeading}>Datos del workspace</h2>
        <div className={styles.sectionBody}>
          <div className={styles.formIntro}>
            <p className={styles.formIntroLead}>
              <strong className={styles.formIntroStrong}>Título</strong> y{' '}
              <strong className={styles.formIntroStrong}>al menos un adjunto</strong> son obligatorios. El{' '}
              <strong className={styles.formIntroStrong}>contexto manual</strong> es opcional y ayuda a orientar el
              análisis.
            </p>
            <p className={styles.formIntroSub}>El procesamiento se encola y se ejecuta en segundo plano.</p>
            <ul className={styles.formIntroList}>
              <li>Al crear, pasarás al detalle del análisis y podrás esperar allí el resultado.</li>
              <li>Si el pipeline falla, el estado lo mostrará y podrás reintentar desde el mismo workspace.</li>
            </ul>
          </div>
          <form className={styles.form} onSubmit={(e) => void handleSubmit(e)} noValidate>
            <label className={styles.label} htmlFor="rfq-new-title">
              <span className={styles.labelTitleRow}>
                Título de la oportunidad
                <span className={styles.requiredMark}>Obligatorio</span>
              </span>
              <input
                id="rfq-new-title"
                className={styles.input}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={512}
                aria-required="true"
                disabled={busy}
                autoComplete="off"
                placeholder="Ej. RFP Hortifrut – integración tesorería"
              />
            </label>

            <div className={styles.formFieldBlock}>
              <div className={styles.labelTitleRow}>
                <label className={styles.labelPlain} htmlFor="rfq-new-files">
                  Documentación adjunta
                  <span className={styles.requiredMark}>Obligatorio</span>
                </label>
              </div>
              <p id="rfq-file-hint" className={styles.fieldHelp}>
                Sube la RFP, pliegos o extracts en PDF o texto plano. Puedes seleccionar varios archivos a la vez. Los
                límites de tamaño y número de adjuntos los aplica el servidor.
              </p>
              <div
                className={
                  files.length > 0
                    ? `${styles.fileDropArea} ${styles.fileDropAreaFilled}`
                    : `${styles.fileDropArea} ${styles.fileDropAreaAwaiting}`
                }
              >
                <input
                  id="rfq-new-files"
                  className={styles.fileInput}
                  type="file"
                  name="sources"
                  multiple
                  aria-required="true"
                  onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])}
                  disabled={busy}
                  aria-describedby="rfq-file-hint"
                />
                {files.length === 0 ? (
                  <p className={styles.fileDropPlaceholder}>Ningún archivo seleccionado aún.</p>
                ) : (
                  <ul className={styles.filePickList} aria-label="Archivos seleccionados">
                    {files.map((f, i) => (
                      <li key={`${f.name}-${i}`}>
                        <span className={styles.fileName}>{f.name}</span>
                        <span className={styles.fileMeta}>{(f.size / 1024).toFixed(f.size < 1024 ? 0 : 1)} KB</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <label className={styles.label} htmlFor="rfq-new-context">
              <span className={styles.labelTitleRow}>
                Contexto manual
                <span className={styles.optionalMark}>Opcional</span>
              </span>
              <textarea
                id="rfq-new-context"
                className={styles.textarea}
                value={manualContext}
                onChange={(e) => setManualContext(e.target.value)}
                disabled={busy}
                placeholder="Notas del consultor, cliente, restricciones conocidas, matices que no están en los adjuntos…"
                rows={5}
              />
            </label>
            <div className={styles.formFooter}>
              <button
                type="submit"
                className={`${styles.primaryBtn} ${styles.primaryBtnWithSpinner}`}
                disabled={busy}
                aria-busy={busy}
              >
                {busy ? (
                  <>
                    <span className={styles.btnSpinner} aria-hidden />
                    {phase ?? 'Enviando…'}
                  </>
                ) : (
                  'Crear y analizar'
                )}
              </button>
              <Link href="/launcher/rfq-analysis" className={styles.secondaryBtn}>
                Volver al listado
              </Link>
            </div>
          </form>
        </div>
      </section>
      {busy && phase ? (
        <p className={styles.visuallyHidden} role="status" aria-live="polite">
          {phase}
        </p>
      ) : null}
    </main>
  );
}
