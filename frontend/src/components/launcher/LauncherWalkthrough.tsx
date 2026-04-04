'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { probeCompanionExtension } from '@/lib/yubiq';
import styles from './LauncherWalkthrough.module.css';

export const LAUNCHER_WALKTHROUGH_STORAGE_KEY = 'avvale_launcher_walkthrough_v1';
export const LAUNCHER_WALKTHROUGH_DISMISSED = 'dismissed';

const EXT_HELP_URL =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_LAUNCHER_EXTENSION_HELP_URL
    ? process.env.NEXT_PUBLIC_LAUNCHER_EXTENSION_HELP_URL.trim()
    : '';

type LauncherWalkthroughProps = {
  open: boolean;
  onClose: (reason: 'later' | 'permanent') => void;
};

const CHROME_EXTENSIONS_URL = 'chrome://extensions';

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

/** Bloque copiar `chrome://extensions` (solo se muestra si la extensión no está detectada). */
function ChromeExtensionsInstallBlock() {
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState(false);

  const handleCopy = async () => {
    setErr(false);
    const ok = await copyTextToClipboard(CHROME_EXTENSIONS_URL);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } else {
      setErr(true);
    }
  };

  return (
    <div className={styles.chromeUrlBlock}>
      <p className={styles.chromeUrlNote}>
        Ve a <strong>ajustes/extensiones</strong>, o <strong>copia este enlace</strong> y pégalo en la{' '}
        <strong>barra de direcciones</strong> de Chrome.
      </p>
      <div className={styles.chromeUrlRow}>
        <code className={styles.chromeUrlText} title={CHROME_EXTENSIONS_URL}>
          {CHROME_EXTENSIONS_URL}
        </code>
        <button
          type="button"
          className={styles.copyChromeUrlBtn}
          onClick={() => void handleCopy()}
          aria-label={`Copiar ${CHROME_EXTENSIONS_URL} al portapapeles`}
        >
          {copied ? 'Copiado' : 'Copiar enlace'}
        </button>
      </div>
      {(copied || err) ? (
        <p
          className={`${styles.chromeUrlFeedback} ${copied ? styles.chromeUrlFeedbackSuccess : styles.chromeUrlFeedbackError}`}
          role="status"
          aria-live="polite"
        >
          {copied ? (
            <>
              Enlace copiado. Pégalo en la <strong>barra de direcciones</strong> de Chrome.
            </>
          ) : (
            'No se pudo copiar. Selecciona el texto manualmente.'
          )}
        </p>
      ) : null}
    </div>
  );
}

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
          paso.
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
        La extensión <strong>Avvale Companion</strong> para Chrome enlaza esta web con flujos como el envío de datos a
        Yubiq. <strong>Aún no está publicada en Chrome Web Store</strong>, pero puedes instalarla en{' '}
        <strong>modo desarrollador</strong>
        {' desde '}
        <a
          href="#"
          className={styles.docLink}
          onClick={(e) => e.preventDefault()}
          title="Enlace disponible próximamente"
        >
          este enlace
        </a>
        .
      </p>
      {probe === 'checking' ? (
        <p className={styles.extensionProbe} role="status" aria-live="polite">
          Comprobando si la extensión está activa en esta página…
        </p>
      ) : null}
      {probe === 'no' ? (
        <p className={`${styles.extensionProbe} ${styles.extensionProbeMuted}`} role="status">
          No se ha detectado la extensión aquí (o aún no incluye la señal de presencia). Si ya la instalaste, recarga la
          página.
        </p>
      ) : null}
      {probe === 'no' ? (
        <>
          <p>Pasos habituales en Chrome:</p>
          <ul>
            <li>
              <ChromeExtensionsInstallBlock />
            </li>
            <li>
              Activa <strong>Modo desarrollador</strong>
            </li>
            <li>
              Pulsa <strong>Cargar desempaquetada</strong> y elige la <strong>carpeta del paquete</strong> que te indique
              tu equipo (build o ZIP descomprimido).
            </li>
          </ul>
          <p>
            Tras instalarla, <strong>recarga esta página</strong> si la extensión no se detecta.
          </p>
        </>
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
          Esta es la pantalla principal de <strong>Avvale Companion Apps</strong>: un único punto de acceso a
          aplicaciones internas.
        </p>
        <p>
          Cada mosaico abre una herramienta: <strong>Activaciones</strong> (gestión por correo y dashboard),{' '}
          <strong>Pipeline Dashboard</strong> (enlace externo a métricas de ventas) y{' '}
          <strong>Yubiq Approve &amp; Seal Filler</strong> (análisis de ofertas PDF e integración con Yubiq).
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose('later');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

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
