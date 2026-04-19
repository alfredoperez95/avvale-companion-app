'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { PageBreadcrumb, PageHero, PageBackLink, ChevronBackIcon } from '@/components/page-hero';
import {
  euroDigitsToStored,
  formatEuroDigitsForDisplay,
  sanitizeEuroDigitsFromInput,
} from '@/lib/euro-deal-value';
import { useUser } from '@/contexts/UserContext';
import styles from '../meddpicc.module.css';

export default function MeddpiccNewPage() {
  const router = useRouter();
  const user = useUser();
  const isAdmin = user?.role === 'ADMIN';
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [valueEuroDigits, setValueEuroDigits] = useState('');
  const [context, setContext] = useState('');
  const [forUserId, setForUserId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      router.push(`/launcher/meddpicc/${data.deal.id}`);
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
        subtitle="Introduce los datos básicos y el contexto libre. En la ficha del deal podrás adjuntar PDF, Excel, Word o .eml; el texto se extraerá en Markdown para el análisis IA."
      />

      <div className={styles.dimCard} style={{ marginTop: 'var(--fiori-space-5)' }}>
        <h2 className={styles.sectionHeading}>Datos del deal</h2>
        <p className={styles.dealCardMeta} style={{ marginBottom: 'var(--fiori-space-4)' }}>
          Los campos básicos y el contexto; en la ficha podrás adjuntar archivos para enriquecer el análisis IA. La etiqueta de
          comercial se asigna sola según el nombre del perfil del usuario propietario del deal (tú, o el usuario indicado si eres
          administrador).
        </p>
        <div className={styles.formGrid}>
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
        </div>
        {isAdmin && (
          <div style={{ marginTop: 'var(--fiori-space-4)' }}>
            <label className={styles.fieldLabel} htmlFor="md-for-user">
              Crear en nombre de (UUID de usuario, opcional)
            </label>
            <input
              id="md-for-user"
              className={styles.input}
              value={forUserId}
              onChange={(e) => setForUserId(e.target.value)}
              placeholder="Solo administradores"
              style={{ maxWidth: '28rem' }}
            />
          </div>
        )}
        <div style={{ marginTop: 'var(--fiori-space-4)' }}>
          <label className={styles.fieldLabel} htmlFor="md-ctx">
            Información del deal
          </label>
          <textarea
            id="md-ctx"
            className={styles.textarea}
            rows={10}
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Emails, notas de reuniones, contexto del cliente…"
          />
        </div>
        {error && (
          <p className={styles.inlineError} style={{ marginTop: 'var(--fiori-space-3)' }}>
            {error}
          </p>
        )}
        <div className={styles.toolbar}>
          <button type="button" className={styles.primaryBtn} disabled={busy} onClick={() => void submit()}>
            {busy ? 'Creando…' : 'Crear deal'}
          </button>
          <Link href="/launcher/meddpicc" className={styles.ghostBtn}>
            Cancelar
          </Link>
        </div>
      </div>
    </div>
  );
}
