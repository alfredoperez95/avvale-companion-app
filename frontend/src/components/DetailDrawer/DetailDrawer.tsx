'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { apiFetch, redirectToLogin } from '@/lib/api';
import type { Activation } from '@/types/activation';
import { StatusTag } from '@/components/StatusTag/StatusTag';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { AttachmentGrid } from '@/components/AttachmentGrid/AttachmentGrid';
import { formatActivationCode } from '@/lib/activation-code';
import { displayActivationErrorMessage } from '@/lib/activation-error-message';
import { parseAttachmentNames, parseAttachmentUrls } from '@/lib/activation-attachment-urls';
import { shouldWarnScannedUrlsOnly } from '@/lib/activation-attachment-warning';
import { formatProjectAmountDisplay } from '@/lib/format-project-amount';
import { HubSpotIcon } from '@/components/HubSpotIcon/HubSpotIcon';
import { sanitizeUserHtml } from '@/lib/sanitize-html';
import styles from './DetailDrawer.module.css';

interface DetailDrawerProps {
  activationId: string | null;
  onClose: () => void;
  onUpdated?: (activation: Activation) => void;
  onDeleted?: () => void;
}

const DRAWER_CLOSE_MS = 280;

function drawerCloseDurationMs(): number {
  if (typeof window === 'undefined') return DRAWER_CLOSE_MS;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : DRAWER_CLOSE_MS;
}

function splitEmails(raw: string): string[] {
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function DrawerSection({
  title,
  children,
  muted,
}: {
  title: string;
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <section className={muted ? `${styles.section} ${styles.sectionMuted}` : styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <div className={styles.sectionContent}>{children}</div>
    </section>
  );
}

function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li className={styles.fieldRow}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={styles.fieldValue}>{children}</span>
    </li>
  );
}

type EmailAccordionPanel = 'to' | 'cc' | 'body';

const EMBEDDED_TRIGGER_CLASS = `${styles.collapseTrigger} ${styles.collapseTriggerEmbedded}`;

function EmailAccordionTrigger({
  id,
  controlsId,
  isOpen,
  onToggle,
  label,
  meta,
}: {
  id: string;
  controlsId?: string;
  isOpen: boolean;
  onToggle: () => void;
  label: string;
  meta?: string;
}) {
  return (
    <button
      type="button"
      className={EMBEDDED_TRIGGER_CLASS}
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-controls={controlsId}
      id={id}
    >
      <span className={styles.accordionTriggerText}>
        <span className={styles.accordionLabel}>{label}</span>
        {meta ? <span className={styles.accordionMeta}> · {meta}</span> : null}
      </span>
      <svg className={styles.collapseIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function RecipientPanel({
  panelId,
  label,
  emails,
  isOpen,
  onToggle,
  embedded,
}: {
  panelId: 'to' | 'cc';
  label: string;
  emails: string[];
  isOpen: boolean;
  onToggle: () => void;
  embedded?: boolean;
}) {
  if (emails.length === 0) return null;
  const countLabel = emails.length === 1 ? '1 destinatario' : `${emails.length} destinatarios`;
  const panelDomId = `recipient-panel-${panelId}`;
  const triggerDomId = `recipient-trigger-${panelId}`;

  return (
    <div className={embedded ? `${styles.recipientAccordion} ${styles.recipientAccordionEmbedded}` : styles.recipientAccordion}>
      {embedded ? (
        <EmailAccordionTrigger
          id={triggerDomId}
          controlsId={panelDomId}
          isOpen={isOpen}
          onToggle={onToggle}
          label={label}
          meta={countLabel}
        />
      ) : (
        <button
          type="button"
          className={styles.collapseTrigger}
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={panelDomId}
          id={triggerDomId}
        >
          <span className={styles.accordionTriggerText}>
            <span className={styles.accordionLabel}>{label}</span>
            <span className={styles.accordionMeta}> · {countLabel}</span>
          </span>
          <svg className={styles.collapseIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      {isOpen ? (
        <div id={panelDomId} role="region" aria-labelledby={triggerDomId} className={embedded ? `${styles.recipientPanel} ${styles.recipientPanelEmbedded}` : styles.recipientPanel}>
          <div className={styles.chipList}>
            {emails.map((email, index) => (
              <a key={`${email}-${index}`} href={`mailto:${email}`} className={styles.chip} title={email}>
                {email}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ExternalLinkRow({
  href,
  label,
  hint,
  icon = 'external',
}: {
  href: string;
  label: string;
  hint?: string;
  icon?: 'external' | 'hubspot';
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={styles.linkRow}>
      <span
        className={icon === 'hubspot' ? `${styles.linkIcon} ${styles.linkIconHubspot}` : styles.linkIcon}
        aria-hidden
      >
        {icon === 'hubspot' ? (
          <HubSpotIcon size={18} />
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M14 3h7v7M10 14L21 3M5 10v11h11" />
          </svg>
        )}
      </span>
      <span className={styles.linkText}>
        <span className={styles.linkLabel}>{label}</span>
        {hint ? <span className={styles.linkHint}>{hint}</span> : null}
      </span>
      <span className={styles.linkExternal} aria-hidden>
        Abrir
      </span>
    </a>
  );
}

function ActivationDrawerBody({
  activation,
  activationId,
  errorMessageDisplay,
  setActivation,
}: {
  activation: Activation;
  activationId: string;
  errorMessageDisplay: string | null;
  setActivation: (value: Activation) => void;
}) {
  const urls = parseAttachmentUrls(activation.attachmentUrls);
  const names = parseAttachmentNames(activation.attachmentNames);
  const attachmentList = urls.map((url, i) => ({ url, name: names[i]?.trim() || url }));
  const toEmails = splitEmails(activation.recipientTo);
  const ccEmails = activation.recipientCc ? splitEmails(activation.recipientCc) : [];
  const [openEmailPanel, setOpenEmailPanel] = useState<EmailAccordionPanel | null>(null);

  useEffect(() => {
    setOpenEmailPanel(null);
  }, [activation.id]);

  const toggleEmailPanel = (panel: EmailAccordionPanel) => {
    setOpenEmailPanel((current) => (current === panel ? null : panel));
  };

  return (
    <>
      <DrawerSection title="Oferta y cliente">
        <ul className={styles.fieldList}>
          {activation.client ? <FieldRow label="Cliente">{activation.client}</FieldRow> : null}
          <FieldRow label="Código oferta">{activation.offerCode}</FieldRow>
          {activation.projectAmount != null && activation.projectAmount !== '' ? (
            <FieldRow label="Importe">
              <span className={styles.fieldValueAmount}>{formatProjectAmountDisplay(activation.projectAmount)}</span>
            </FieldRow>
          ) : null}
          {activation.projectType ? (
            <FieldRow label="Tipo">
              {activation.projectType === 'CONSULTORIA' ? 'Consultoría' : 'Software'}
            </FieldRow>
          ) : null}
        </ul>
        {activation.hubspotUrl ? (
          <div className={styles.hubspotWrap}>
            <ExternalLinkRow
              href={activation.hubspotUrl}
              label="Ver deal en HubSpot"
              hint="Abre la ficha en HubSpot"
              icon="hubspot"
            />
          </div>
        ) : null}
      </DrawerSection>

      <DrawerSection title="Correo electrónico">
        <div className={styles.emailPanel}>
          <div className={styles.emailSubjectRow}>
            <span className={styles.emailSubjectIcon} aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <path d="M4 6h16v12H4z" />
                <path d="M4 7l8 6 8-6" />
              </svg>
            </span>
            <p className={styles.emailSubjectLine}>
              <span className={styles.emailSubjectPrefix}>Asunto · </span>
              {activation.subject}
            </p>
          </div>

          {(toEmails.length > 0 || ccEmails.length > 0 || activation.body) && (
            <div className={styles.emailAccordionList}>
              <RecipientPanel
                panelId="to"
                label="Para"
                emails={toEmails}
                isOpen={openEmailPanel === 'to'}
                onToggle={() => toggleEmailPanel('to')}
                embedded
              />
              <RecipientPanel
                panelId="cc"
                label="CC"
                emails={ccEmails}
                isOpen={openEmailPanel === 'cc'}
                onToggle={() => toggleEmailPanel('cc')}
                embedded
              />
              {activation.body ? (
                <div className={styles.emailBodyAccordion}>
                  <EmailAccordionTrigger
                    id="email-body-trigger"
                    controlsId="email-body-panel"
                    isOpen={openEmailPanel === 'body'}
                    onToggle={() => toggleEmailPanel('body')}
                    label={openEmailPanel === 'body' ? 'Ocultar cuerpo del mensaje' : 'Cuerpo del mensaje'}
                  />
                  {openEmailPanel === 'body' ? (
                    <div id="email-body-panel" role="region" aria-labelledby="email-body-trigger" className={styles.emailBodyEmbedded}>
                      {/<[a-z][\s\S]*>/i.test(activation.body) ? (
                        <div dangerouslySetInnerHTML={{ __html: sanitizeUserHtml(activation.body) }} />
                      ) : (
                        <pre>{activation.body}</pre>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </DrawerSection>

      <DrawerSection title="Áreas involucradas">
        {activation.activationAreas?.length || activation.activationSubAreas?.length ? (
          <ul className={styles.bulletList}>
            {activation.activationAreas?.map((aa) => (
              <li key={`area-${aa.area.id}`}>{aa.area.name}</li>
            ))}
            {activation.activationSubAreas?.map((asa) => (
              <li key={`sub-${asa.subArea.id}`}>
                {asa.subArea.area.name} › {asa.subArea.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.fieldValueMuted}>Sin áreas asignadas</p>
        )}
      </DrawerSection>

      {attachmentList.length > 0 ? (
        <DrawerSection title="Enlaces escaneados">
          <div className={styles.linkList}>
            {attachmentList.map(({ url, name }, i) => (
              <ExternalLinkRow key={`${url}-${i}`} href={url} label={name} hint="Documento en HubSpot" />
            ))}
          </div>
        </DrawerSection>
      ) : null}

      {activation.attachments && activation.attachments.length > 0 ? (
        <DrawerSection title="Archivos adjuntos">
          <AttachmentGrid
            attachments={activation.attachments}
            activationId={activation.id}
            apiFetch={apiFetch}
            columns={3}
            onDeleted={() => {
              apiFetch(`/api/activations/${activationId}`)
                .then((r) => (r.ok ? r.json() : null))
                .then((data) => data && setActivation(data));
            }}
          />
        </DrawerSection>
      ) : null}

      <DrawerSection title="Auditoría" muted>
        <ul className={styles.fieldList}>
          <FieldRow label="Creado">{new Date(activation.createdAt).toLocaleString('es')}</FieldRow>
          <FieldRow label="Autor">{activation.createdBy}</FieldRow>
          {activation.makeSentAt ? (
            <FieldRow label="Enviado">{new Date(activation.makeSentAt).toLocaleString('es')}</FieldRow>
          ) : null}
          {activation.makeRunId ? <FieldRow label="Run ID">{activation.makeRunId}</FieldRow> : null}
          {errorMessageDisplay ? (
            <FieldRow label="Error">
              <span className={styles.errorField}>{errorMessageDisplay}</span>
            </FieldRow>
          ) : null}
        </ul>
      </DrawerSection>
    </>
  );
}

export function DetailDrawer({ activationId, onClose, onUpdated, onDeleted }: DetailDrawerProps) {
  const [activation, setActivation] = useState<Activation | null>(null);
  const [loading, setLoading] = useState(!!activationId);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSendAttachmentWarning, setShowSendAttachmentWarning] = useState(false);
  const [error, setError] = useState('');
  const [portalReady, setPortalReady] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const beginClose = useCallback(() => {
    if (isClosing || !activationId) return;
    setIsClosing(true);
    delete document.body.dataset.detailDrawerOpen;
  }, [activationId, isClosing]);

  useEffect(() => {
    if (!isClosing) return;
    const duration = drawerCloseDurationMs();
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      setIsClosing(false);
      onCloseRef.current();
    }, duration);
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [isClosing]);

  useEffect(() => {
    if (!activationId) {
      delete document.body.dataset.detailDrawerOpen;
      return;
    }
    setIsClosing(false);
    document.body.dataset.detailDrawerOpen = '';
    return () => {
      if (!closeTimerRef.current) {
        delete document.body.dataset.detailDrawerOpen;
      }
    };
  }, [activationId]);

  useEffect(() => {
    if (!activationId) {
      setActivation(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    apiFetch(`/api/activations/${activationId}`)
      .then((r) => {
        if (r.status === 401) {
          redirectToLogin();
          return null;
        }
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        setActivation(data);
      })
      .finally(() => setLoading(false));
  }, [activationId]);

  const performSend = async () => {
    if (!activationId) return;
    setError('');
    setSending(true);
    try {
      const res = await apiFetch(`/api/activations/${activationId}/send`, { method: 'POST' });
      if (res.status === 401) {
        localStorage.removeItem('token');
        redirectToLogin();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? 'Error al solicitar envío');
        return;
      }
      setActivation(data);
      onUpdated?.(data);
    } finally {
      setSending(false);
    }
  };

  const handleSend = async () => {
    if (!activationId || !activation) return;
    if (shouldWarnScannedUrlsOnly(activation)) {
      setShowSendAttachmentWarning(true);
      return;
    }
    return performSend();
  };

  const handleDeleteClick = () => setShowDeleteConfirm(true);

  const handleDeleteConfirm = async () => {
    if (!activationId || !activation) return;
    setShowDeleteConfirm(false);
    setError('');
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/activations/${activationId}`, { method: 'DELETE' });
      if (res.status === 401) {
        localStorage.removeItem('token');
        redirectToLogin();
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? 'Error al eliminar');
        return;
      }
      onDeleted?.();
      beginClose();
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => setShowDeleteConfirm(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') beginClose();
  };

  if (!activationId) return null;

  const errorMessageDisplay = displayActivationErrorMessage(activation?.errorMessage);
  const hasFooterActions =
    activation &&
    (activation.status === 'DRAFT' ||
      activation.status === 'FAILED' ||
      activation.status === 'RETRYING');

  const drawerPanel = (
    <>
      <button
        type="button"
        className={isClosing ? `${styles.scrim} ${styles.scrimLeaving}` : styles.scrim}
        onClick={beginClose}
        aria-label="Cerrar panel"
        disabled={isClosing}
      />
      <div
        className={isClosing ? `${styles.drawer} ${styles.drawerLeaving}` : styles.drawer}
        role="dialog"
        aria-labelledby="drawer-title"
        aria-modal="true"
        onKeyDown={handleKeyDown}
      >
        <header className={styles.header}>
          <div className={styles.headerMain}>
            {!loading && activation && (
              <div className={styles.headerMeta}>
                <StatusTag status={activation.status} />
                <span className={styles.codeBadge}>{formatActivationCode(activation.activationNumber)}</span>
              </div>
            )}
            <h2 id="drawer-title" className={styles.title}>
              {loading ? 'Cargando…' : activation?.projectName ?? 'Detalle de activación'}
            </h2>
            {!loading && activation && (
              <p className={styles.subtitle}>
                {activation.client ? (
                  <span className={styles.subtitleClient}>{activation.client}</span>
                ) : null}
                Activación n.º {activation.activationNumber}
              </p>
            )}
          </div>
          <button type="button" className={styles.close} onClick={beginClose} aria-label="Cerrar" disabled={isClosing}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className={styles.body}>
          {loading && <p className={styles.loadingText}>Cargando detalle…</p>}
          {!loading && activation && (
            <ActivationDrawerBody
              activation={activation}
              activationId={activationId}
              errorMessageDisplay={errorMessageDisplay}
              setActivation={setActivation}
            />
          )}
        </div>

        {!loading && activation && (
          <footer className={styles.footer}>
            {error ? <p className={styles.errorBanner}>{error}</p> : null}
            <div className={styles.footerActions}>
              {activation.status === 'DRAFT' && (
                <Link href={`/launcher/activations/activate/${activationId}/edit`} className={styles.btn}>
                  Editar borrador
                </Link>
              )}
              {hasFooterActions && (
                <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSend} disabled={sending}>
                  {sending ? 'Enviando…' : 'Enviar activación'}
                </button>
              )}
            </div>
            <div className={styles.footerDanger}>
              <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={handleDeleteClick} disabled={deleting}>
                {deleting ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </footer>
        )}
      </div>
    </>
  );

  return (
    <>
      {portalReady ? createPortal(drawerPanel, document.body) : null}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Eliminar activación"
        message="¿Eliminar esta activación? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
      <ConfirmDialog
        open={showSendAttachmentWarning}
        title="No se han añadido adjuntos"
        message="No se han añadido adjuntos. Las URLs escaneadas solo serán accesibles por usuarios con acceso a HubSpot."
        confirmLabel="Enviar de todas formas"
        cancelLabel="Cancelar"
        confirmVariant="primary"
        onConfirm={() => {
          setShowSendAttachmentWarning(false);
          void performSend();
        }}
        onCancel={() => setShowSendAttachmentWarning(false)}
      />
    </>
  );
}
