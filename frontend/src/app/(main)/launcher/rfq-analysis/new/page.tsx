'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, apiUpload } from '@/lib/api';
import { MultiDropzoneUploader } from '@/components/rfq/MultiDropzoneUploader/MultiDropzoneUploader';
import { validateUploadFiles } from '@/lib/validate-upload';
import { PageBreadcrumb, PageHero, PageBackLink, ChevronBackIcon } from '@/components/page-hero';
import styles from '../rfq-analysis.module.css';
import layout from './page.module.css';

type KycCompanyOption = {
  id: number;
  name: string;
  sector: string | null;
  city: string | null;
};

export default function RfqAnalysisNewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [title, setTitle] = useState('');
  const [manualContext, setManualContext] = useState('');
  const [kycCompanyId, setKycCompanyId] = useState('');
  const [kycCompanies, setKycCompanies] = useState<KycCompanyOption[]>([]);
  const [kycCompaniesLoading, setKycCompaniesLoading] = useState(true);
  const [kycCompaniesError, setKycCompaniesError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setKycCompaniesLoading(true);
      setKycCompaniesError(null);
      try {
        const res = await apiFetch('/api/kyc/companies');
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || 'No se pudo cargar el listado de clientes KYC');
        }
        const data = (await res.json()) as KycCompanyOption[];
        if (!cancelled) {
          setKycCompanies(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        if (!cancelled) {
          setKycCompanies([]);
          setKycCompaniesError(e instanceof Error ? e.message : 'Error al cargar clientes KYC');
        }
      } finally {
        if (!cancelled) setKycCompaniesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const q = searchParams.get('kycCompanyId');
    if (!q) return;
    const n = Number.parseInt(q, 10);
    if (!Number.isFinite(n) || n < 1) return;
    const idStr = String(n);
    if (kycCompaniesLoading || kycCompaniesError) return;
    if (!kycCompanies.some((c) => String(c.id) === idStr)) return;
    setKycCompanyId((prev) => (prev === idStr ? prev : idStr));
  }, [searchParams, kycCompaniesLoading, kycCompaniesError, kycCompanies]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError('Indica un título');
      return;
    }
    const kycIdNum = Number.parseInt(kycCompanyId, 10);
    if (!kycCompanyId || !Number.isFinite(kycIdNum) || kycIdNum < 1) {
      setError('Selecciona un cliente con perfil KYC');
      return;
    }
    if (files.length === 0) {
      setError('Adjunta al menos un archivo (la documentación de la oportunidad es obligatoria).');
      return;
    }
    const validationError = validateUploadFiles('rfq', files);
    if (validationError) {
      setError(validationError);
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
          kycCompanyId: kycIdNum,
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
    <main className={layout.page}>
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

      <p className={layout.lead}>
        <strong className={styles.formIntroStrong}>Título</strong>,{' '}
        <strong className={styles.formIntroStrong}>cliente (KYC)</strong> y{' '}
        <strong className={styles.formIntroStrong}>al menos un adjunto</strong> son obligatorios. El{' '}
        <strong className={styles.formIntroStrong}>contexto manual</strong> es opcional. Tras crear, irás al detalle del
        análisis; el procesamiento se ejecuta en segundo plano.
      </p>

      {error ? (
        <div className={styles.errorBox} role="alert">
          {error}
        </div>
      ) : null}

      <section className={layout.primaryCard} aria-label="Nuevo análisis RFQ">
        <div className={layout.primaryCardRow}>
          <div className={layout.cardSection}>
            <div className={layout.sectionHead}>
              <span className={layout.stepBadge} aria-hidden>
                1
              </span>
              <div>
                <h2 className={layout.sectionTitle}>Documentación</h2>
                <p className={layout.sectionDesc}>
                  Arrastra archivos o selecciónalos desde tu equipo. RFP, pliegos, extracts (PDF, texto u hojas de cálculo
                  compatibles). Puedes añadir varios a la vez.
                </p>
              </div>
            </div>
            <MultiDropzoneUploader files={files} onFilesChange={setFiles} disabled={busy} />
          </div>

          <div className={`${layout.cardSection} ${layout.cardSectionMuted}`}>
            <div className={layout.sectionHead}>
              <span className={layout.stepBadge} aria-hidden>
                2
              </span>
              <div>
                <h2 className={layout.sectionTitle}>Datos del workspace</h2>
                <p className={layout.sectionDesc}>
                  Elige el cliente en KYC, nombra la oportunidad y, si quieres, añade notas que no figuren en los
                  adjuntos.
                </p>
              </div>
            </div>

            <form className={layout.formStack} onSubmit={(e) => void handleSubmit(e)} noValidate>
              <div className={layout.kycFieldGroup}>
                <label className={`${styles.label} ${layout.kycLabel}`} htmlFor="rfq-new-kyc-client">
                  <span className={styles.labelTitleRow}>
                    Cliente (KYC)
                    <span className={styles.requiredMark}>Obligatorio</span>
                  </span>
                  <select
                    id="rfq-new-kyc-client"
                    className={`${styles.input} ${layout.kycSelect}`}
                    value={kycCompanyId}
                    onChange={(e) => setKycCompanyId(e.target.value)}
                    disabled={busy || kycCompaniesLoading || !!kycCompaniesError}
                    aria-required="true"
                    aria-busy={kycCompaniesLoading}
                    aria-invalid={kycCompaniesError ? true : undefined}
                  >
                    <option value="" disabled>
                      {kycCompaniesLoading
                        ? 'Cargando empresas…'
                        : kycCompaniesError
                          ? 'Error al cargar'
                          : 'Selecciona un cliente…'}
                    </option>
                    {kycCompanies.map((c) => {
                      const bits = [c.sector, c.city].filter(Boolean).join(' · ');
                      const label = bits ? `${c.name} (${bits})` : c.name;
                      return (
                        <option key={c.id} value={String(c.id)}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                  <div className={layout.kycBelowSelect}>
                    {kycCompaniesError ? (
                      <p className={layout.kycAlert} role="alert">
                        {kycCompaniesError}
                      </p>
                    ) : null}
                    {!kycCompaniesLoading && !kycCompaniesError && kycCompanies.length === 0 ? (
                      <p className={layout.kycNotice} role="status">
                        No hay empresas con perfil KYC. Crea o activa una empresa en KYC para continuar.
                      </p>
                    ) : null}
                    <div className={layout.kycFieldHint}>
                      <p className={layout.kycFieldHintLine}>
                        Solo aparecen empresas con perfil activo en KYC.
                      </p>
                      <p className={layout.kycFieldHintLine}>
                        <Link href="/launcher/kyc" className={layout.kycFieldHintLink}>
                          ¿No aparece la empresa? Crea o activa su perfil en KYC
                        </Link>
                      </p>
                    </div>
                  </div>
                </label>
              </div>

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

              <div className={`${styles.formFooter} ${layout.formFooter}`}>
                <button
                  type="submit"
                  className={`${styles.primaryBtn} ${styles.primaryBtnWithSpinner}`}
                  disabled={
                    busy ||
                    kycCompaniesLoading ||
                    !!kycCompaniesError ||
                    kycCompanies.length === 0
                  }
                  aria-busy={busy}
                >
                  {busy ? (
                    <>
                      <span className={styles.btnSpinner} aria-hidden />
                      <span>{phase ?? 'Enviando…'}</span>
                      <img
                        src="/img/Claude_AI_symbol.svg"
                        alt=""
                        width={18}
                        height={18}
                        className={styles.primaryBtnClaudeIcon}
                        aria-hidden
                      />
                    </>
                  ) : (
                    <>
                      <span>Crear y analizar</span>
                      <img
                        src="/img/Claude_AI_symbol.svg"
                        alt=""
                        width={18}
                        height={18}
                        className={styles.primaryBtnClaudeIcon}
                        aria-hidden
                      />
                    </>
                  )}
                </button>
                <Link href="/launcher/rfq-analysis" className={styles.secondaryBtn}>
                  Volver al listado
                </Link>
              </div>
            </form>
          </div>
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
