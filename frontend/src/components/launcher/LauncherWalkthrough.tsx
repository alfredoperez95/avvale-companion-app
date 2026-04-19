'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { isDialogEnterTargetInteractive } from '@/lib/dialog-keyboard';
import { probeCompanionExtension } from '@/lib/yubiq';
import styles from './LauncherWalkthrough.module.css';

export const LAUNCHER_WALKTHROUGH_STORAGE_KEY = 'avvale_launcher_walkthrough_v1';
export const LAUNCHER_WALKTHROUGH_DISMISSED = 'dismissed';

const EXT_HELP_URL =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_LAUNCHER_EXTENSION_HELP_URL
    ? process.env.NEXT_PUBLIC_LAUNCHER_EXTENSION_HELP_URL.trim()
    : '';

/** Ficha oficial en Chrome Web Store (instalación recomendada). */
const CHROME_WEB_STORE_COMPANION_URL =
  'https://chromewebstore.google.com/detail/avvale-companion/afpdgamffgonkjblodeiefibbobmaibg';

type LauncherWalkthroughProps = {
  open: boolean;
  onClose: (reason: 'later' | 'permanent') => void;
};

function WalkthroughStepExtensionBody() {
  const [probe, setProbe] = useState<'checking' | 'yes' | 'no'>('checking');

  useEffect(() => {
    let cancelled = false;
    void probeCompanionExtension({ timeoutMs: 700 }).then((ok) => {
      if (!cancelled) setProbe(ok ? 'yes' : 'no');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (probe === 'yes') {
    return (
      <>
        <p className={`${styles.extensionProbe} ${styles.extensionProbeOk}`} role="status">
          <strong>Extensión Avvale Companion</strong> detectada en esta pestaña.
        </p>
        <p>
          Ya puedes usar las funciones que dependen de la extensión (por ejemplo integraciones con{' '}
          <strong>HubSpot</strong> o el envío de datos a <strong>Yubiq</strong>). No necesitas instalar nada más en este
          paso. Es totalmente compatible con Microsoft Edge.
        </p>
        {EXT_HELP_URL ? (
          <a className={styles.docLink} href={EXT_HELP_URL} target="_blank" rel="noopener noreferrer">
            Documentación interna de la extensión
          </a>
        ) : null}
      </>
    );
  }

  return (
    <>
      <p>
        La extensión <strong>Avvale Companion</strong> conecta esta web con distintos flujos, como la extracción de
        información desde HubSpot o el envío de datos a Yubiq. Está disponible en la Chrome Web Store, donde puedes
        instalarla fácilmente desde tu navegador.
      </p>
      <div className={styles.extensionInstallWrap}>
        <div className={styles.extensionInstallRow}>
          <a
            href={CHROME_WEB_STORE_COMPANION_URL}
            className={styles.extensionInstallBtn}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instalar Avvale Companion desde Chrome Web Store (se abre en una pestaña nueva)"
          >
            Instalar
          </a>
          <div className={styles.extensionBrowserIcons}>
            <img
              src="/img/browser-google-chrome.svg"
              alt="Google Chrome"
              width={20}
              height={20}
              className={styles.browserIcon}
              decoding="async"
            />
            <img
              src="/img/browser-microsoft-edge.svg"
              alt="Microsoft Edge"
              width={20}
              height={20}
              className={styles.browserIcon}
              decoding="async"
            />
          </div>
        </div>
      </div>
      <p>Es totalmente compatible con Microsoft Edge.</p>
      {probe === 'checking' ? (
        <p className={styles.extensionProbe} role="status" aria-live="polite">
          Comprobando si la extensión está activa en esta página…
        </p>
      ) : null}
      {probe === 'no' ? (
        <p className={`${styles.extensionProbe} ${styles.extensionProbeMuted}`} role="status">
          No se ha detectado la extensión en esta pestaña (o aún no responde al test de presencia). Si acabas de
          instalarla desde Chrome Web Store, <strong>recarga la página</strong>.
        </p>
      ) : null}
      {(probe === 'checking' || probe === 'no') && EXT_HELP_URL ? (
        <a className={styles.docLink} href={EXT_HELP_URL} target="_blank" rel="noopener noreferrer">
          Documentación interna de la extensión
        </a>
      ) : null}
    </>
  );
}

const STEPS = [
  {
    title: 'App Launcher',
    body: (
      <>
        <p>
          Esta es la pantalla principal de <strong>Avvale Companion App</strong>: un único punto de acceso a
          aplicaciones internas.
        </p>
        <p>
          Cada mosaico abre una herramienta: <strong>Activaciones</strong> (gestión por correo y dashboard),{' '}
          <strong>Pipeline Dashboard</strong> (enlace externo a métricas de ventas),{' '}
          <strong>Yubiq Approve &amp; Seal Filler</strong> (análisis de ofertas PDF e integración con Yubiq) y{' '}
          <strong>Análisis RFQs</strong> (workspace por oportunidad con documentos, insight estructurado y chat).
        </p>
      </>
    ),
  },
  {
    title: 'Navegación y personalización',
    body: (
      <>
        <p>
          Usa el menú lateral o la cabecera para moverte entre secciones. En <strong>Perfil</strong> puedes ajustar
          cuenta, apariencia y, cuando aplique, credenciales para servicios de IA.
        </p>
        <p>
          Puedes cambiar el orden de los mosaicos con <strong>Editar mis intereses</strong> (o{' '}
          <strong>Ordenar mosaicos</strong> si cerraste el banner): arrastra por el asa y el orden se guarda en tu
          cuenta.
        </p>
      </>
    ),
  },
  {
    title: 'Extensión Chrome Avvale Companion',
    body: <WalkthroughStepExtensionBody />,
  },
];

export function LauncherWalkthrough({ open, onClose }: LauncherWalkthroughProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const prevActive = useRef<HTMLElement | null>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!open) {
      setStep(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const stepCount = STEPS.length;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose('later');
        return;
      }
      if (e.key === 'Enter') {
        if (isDialogEnterTargetInteractive(e.target)) return;
        e.preventDefault();
        const isLast = step >= stepCount - 1;
        if (!isLast) setStep((s) => s + 1);
        else onClose('later');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, step]);

  useEffect(() => {
    if (!open) return;
    prevActive.current = document.activeElement as HTMLElement;
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>('button')?.focus();
    }, 0);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      prevActive.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const stepCount = STEPS.length;
  const isLast = step >= stepCount - 1;
  const content = STEPS[step];

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose('later');
      }}
    >
      <div
        ref={panelRef}
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <p className={styles.stepMeta}>
            Paso {step + 1} de {stepCount}
          </p>
          <h2 id={titleId} className={styles.title}>
            {content.title}
          </h2>
        </div>
        <div className={styles.body}>{content.body}</div>
        <div className={styles.footer}>
          <div className={styles.dots} aria-hidden>
            {STEPS.map((_, i) => (
              <span key={i} className={`${styles.dot} ${i === step ? styles.dotActive : ''}`} />
            ))}
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.btnGhost} onClick={() => onClose('later')}>
              Más tarde
            </button>
            {step > 0 ? (
              <button type="button" className={styles.btnSecondary} onClick={() => setStep((s) => s - 1)}>
                Anterior
              </button>
            ) : null}
            {!isLast ? (
              <button type="button" className={styles.btnPrimary} onClick={() => setStep((s) => s + 1)}>
                Siguiente
              </button>
            ) : (
              <>
                <button type="button" className={styles.btnSecondary} onClick={() => onClose('permanent')}>
                  No volver a mostrar
                </button>
                <button type="button" className={styles.btnPrimary} onClick={() => onClose('later')}>
                  Listo
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
