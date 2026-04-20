'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, apiUpload } from '@/lib/api';
import { MeddpiccContextDropzone } from '@/components/meddpicc/MeddpiccContextDropzone';
import { PageBreadcrumb, PageHero, PageBackLink, ChevronBackIcon } from '@/components/page-hero';
import {
  euroDigitsToStored,
  formatEuroDigitsForDisplay,
  sanitizeEuroDigitsFromInput,
} from '@/lib/euro-deal-value';
import { useUser } from '@/contexts/UserContext';
import styles from '../meddpicc.module.css';

type AdminUserRow = { id: string; email: string; name: string | null; lastName: string | null };

function formatUserOption(u: AdminUserRow): string {
  const label = [u.name, u.lastName].filter(Boolean).join(' ');
  return label ? `${u.email} (${label})` : u.email;
}

const MAX_MEDDPICC_ATTACHMENTS = 25;
/** Máximo de archivos por petición multipart en Nest (`FilesInterceptor`). */
const MEDDPICC_ATTACH_UPLOAD_BATCH = 15;

export default function MeddpiccNewPage() {
  const router = useRouter();
  const user = useUser();
  const isAdmin = user?.role === 'ADMIN';
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [valueEuroDigits, setValueEuroDigits] = useState('');
  const [context, setContext] = useState('');
  const [forUserId, setForUserId] = useState('');
  const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Archivos en cola: se suben tras crear el deal (misma API que en la ficha). */
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [attachmentUploadBusy, setAttachmentUploadBusy] = useState(false);
  const pendingFilesRef = useRef<File[]>([]);
  pendingFilesRef.current = pendingFiles;

  const sortedUsers = useMemo(
    () => [...adminUsers].sort((a, b) => a.email.localeCompare(b.email, 'es')),
    [adminUsers],
  );

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    setUsersLoading(true);
    setUsersError(null);
    void (async () => {
      try {
        const res = await apiFetch('/api/users');
        if (cancelled) return;
        if (!res.ok) {
          setUsersError('No se pudo cargar la lista de usuarios');
          setAdminUsers([]);
          return;
        }
        const rows = (await res.json()) as AdminUserRow[];
        if (!cancelled) setAdminUsers(rows);
      } catch {
        if (!cancelled) {
          setUsersError('Error de red al cargar usuarios');
          setAdminUsers([]);
        }
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const addPendingFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const incoming = Array.from(list);
    const prev = pendingFilesRef.current;
    if (prev.length + incoming.length > MAX_MEDDPICC_ATTACHMENTS) {
      setError(
        `Como máximo ${MAX_MEDDPICC_ATTACHMENTS} adjuntos por deal. Quitar algunos de la cola o súbelos después en la ficha.`,
      );
      return;
    }
    setPendingFiles([...prev, ...incoming]);
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const submit = async () => {
    if (!name.trim()) {
      setError('El nombre del deal es obligatorio');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        company: company.trim(),
        value: euroDigitsToStored(valueEuroDigits),
        context: context.trim() || undefined,
      };
      if (isAdmin && forUserId.trim()) body.forUserId = forUserId.trim();
      const res = await apiFetch('/api/meddpicc/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        const msg = Array.isArray(j.message) ? j.message.join(', ') : j.message;
        setError(msg || 'No se pudo crear el deal');
        return;
      }
      const data = (await res.json()) as { deal: { id: string } };
      const dealId = data.deal.id;

      if (pendingFiles.length > 0) {
        setAttachmentUploadBusy(true);
        try {
          for (let offset = 0; offset < pendingFiles.length; offset += MEDDPICC_ATTACH_UPLOAD_BATCH) {
            const slice = pendingFiles.slice(offset, offset + MEDDPICC_ATTACH_UPLOAD_BATCH);
            const fd = new FormData();
            for (const f of slice) {
              fd.append('files', f);
            }
            const up = await apiUpload(`/api/meddpicc/deals/${dealId}/attachments`, fd);
            if (!up.ok) {
              const j = (await up.json().catch(() => ({}))) as { message?: string | string[] };
              const msg = Array.isArray(j.message) ? j.message.join(', ') : j.message;
              setError(
                msg
                  ? `Deal creado, pero los adjuntos no se subieron por completo: ${msg}. Puedes subir el resto desde la ficha del deal.`
                  : 'Deal creado, pero no se pudieron subir todos los adjuntos. Puedes completarlos desde la ficha del deal.',
              );
              router.push(`/launcher/meddpicc/${dealId}`);
              return;
            }
          }
        } finally {
          setAttachmentUploadBusy(false);
        }
      }

      router.push(`/launcher/meddpicc/${dealId}`);
    } catch {
      setError('Error de red');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.page}>
      <PageBreadcrumb>
        <PageBackLink href="/launcher/meddpicc">
          <ChevronBackIcon />
          MEDDPICC
        </PageBackLink>
      </PageBreadcrumb>
      <PageHero
        title="Nuevo deal"
        subtitle="Datos básicos, contexto en texto y, si quieres, adjuntos (PDF, Excel, Word, .eml): al crear el deal se suben y el texto se extrae a Markdown para el análisis IA, igual que en la ficha."
      />

      <div className={styles.dimCard} style={{ marginTop: 'var(--fiori-space-5)' }}>
        <h2 className={styles.sectionHeading}>Datos del deal</h2>
        <p className={styles.dealCardMeta} style={{ marginBottom: 'var(--fiori-space-4)' }}>
          Los campos básicos, el contexto en texto y, opcionalmente, adjuntos en cola (se suben al pulsar Crear deal). La etiqueta
          de comercial se asigna sola según el perfil del propietario del deal (tú, o el usuario indicado si eres administrador).
        </p>
        <div className={`${styles.formGridThree} ${isAdmin ? styles.formGridThreeFour : ''}`}>
          <div>
            <label className={styles.fieldLabel} htmlFor="md-name">
              Nombre del deal *
            </label>
            <input id="md-name" className={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className={styles.fieldLabel} htmlFor="md-company">
              Empresa
            </label>
            <input id="md-company" className={styles.input} value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>
          <div>
            <label className={styles.fieldLabel} htmlFor="md-value">
              Valor estimado (€)
            </label>
            <input
              id="md-value"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className={`${styles.input} ${styles.inputEuro}`}
              value={formatEuroDigitsForDisplay(valueEuroDigits)}
              onChange={(e) => setValueEuroDigits(sanitizeEuroDigitsFromInput(e.target.value))}
              placeholder="0 €"
            />
          </div>
          {isAdmin && (
            <div>
              <label className={styles.fieldLabel} htmlFor="md-for-user">
                Crear en nombre de (opcional)
              </label>
              <select
                id="md-for-user"
                className={styles.select}
                value={forUserId}
                onChange={(e) => setForUserId(e.target.value)}
                disabled={usersLoading}
                aria-busy={usersLoading}
              >
                <option value="">
                  {usersLoading ? 'Cargando usuarios…' : 'Yo (usuario que crea el deal)'}
                </option>
                {!usersLoading &&
                  sortedUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {formatUserOption(u)}
                    </option>
                  ))}
              </select>
              {usersError ? (
                <p className={styles.dealCardMeta} style={{ marginTop: 'var(--fiori-space-2)' }}>
                  {usersError}. Puedes crear el deal para ti; el desplegable no incluye el resto de usuarios.
                </p>
              ) : null}
            </div>
          )}
          <div className={styles.formGridRowFull}>
            <label className={styles.fieldLabel} htmlFor="md-ctx">
              Contexto del deal
            </label>
            <textarea
              id="md-ctx"
              className={styles.textarea}
              rows={10}
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Resume aquí lo esencial en texto libre: objetivo del deal, reuniones, riesgos o hipótesis. Los correos, propuestas y documentos largos no hace falta pegarlos: en la ficha podrás adjuntarlos y se extraerán a markdown para el análisis IA junto con este contexto."
            />
          </div>
        </div>

        <div className={styles.attachSection}>
          <div className={styles.attachSectionHead}>
            <h3 className={styles.attachSectionTitle}>Adjuntos para el contexto (opcional)</h3>
            <p className={styles.attachSectionDesc}>
              Misma experiencia que en la ficha del deal: al crear, los archivos se suben y el texto se extrae a Markdown para
              combinarlo con el contexto libre en el análisis IA. Hasta {MAX_MEDDPICC_ATTACHMENTS} archivos por deal; 25&nbsp;MB
              por archivo.
            </p>
          </div>
          <MeddpiccContextDropzone
            disabled={busy}
            uploading={attachmentUploadBusy}
            onFilesSelected={(list) => addPendingFiles(list)}
          />
          {pendingFiles.length > 0 ? (
            <ul className={styles.attachList}>
              {pendingFiles.map((f, i) => (
                <li key={`${f.name}-${f.size}-${i}`} className={styles.attachItem}>
                  <div className={styles.attachItemHead}>
                    <p className={styles.attachItemName}>{f.name}</p>
                    <button
                      type="button"
                      className={styles.removeAttachBtn}
                      disabled={busy}
                      onClick={() => removePendingFile(i)}
                    >
                      Quitar
                    </button>
                  </div>
                  <p className={styles.attachItemMeta}>
                    {(f.size / (1024 * 1024)).toFixed(1)} MB · pendiente de subir al crear el deal
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {error && (
          <p className={styles.inlineError} style={{ marginTop: 'var(--fiori-space-3)' }}>
            {error}
          </p>
        )}
        <div className={styles.toolbar}>
          <button type="button" className={styles.primaryBtn} disabled={busy} onClick={() => void submit()}>
            {busy ? (pendingFiles.length > 0 ? 'Creando y subiendo…' : 'Creando…') : 'Crear deal'}
          </button>
          <Link href="/launcher/meddpicc" className={styles.ghostBtn}>
            Cancelar
          </Link>
        </div>
      </div>
    </div>
  );
}
