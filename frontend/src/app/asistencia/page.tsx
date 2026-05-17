'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CHROME_WEB_STORE_COMPANION_URL,
  LAUNCHER_EXTENSION_HELP_URL,
} from '@/lib/companion-extension';
import { probeCompanionExtension } from '@/lib/yubiq';
import styles from './page.module.css';

const CONTACT_EMAIL = 'no-reply@avvalecompanion.app';

const TOC = [
  { id: 'inicio', label: 'Inicio rápido' },
  { id: 'vision', label: 'Visión general' },
  { id: 'modulos', label: 'Módulos' },
  { id: 'activaciones', label: 'Activaciones' },
  { id: 'adjuntos', label: 'Adjuntos' },
  { id: 'extension', label: 'Extensión' },
  { id: 'rfq', label: 'RFQ' },
  { id: 'yubiq', label: 'Yubiq' },
  { id: 'cuenta', label: 'Cuenta' },
  { id: 'faq', label: 'Problemas frecuentes' },
  { id: 'contacto', label: 'Contacto' },
] as const;

const ACTIVATION_STATUSES = [
  { code: 'DRAFT', label: 'Borrador', hint: 'Editable; aún no se ha enviado al flujo.' },
  { code: 'QUEUED', label: 'En cola', hint: 'Pendiente de procesamiento por el worker.' },
  { code: 'PROCESSING', label: 'Procesando', hint: 'El envío está en curso.' },
  { code: 'RETRYING', label: 'Reintentando', hint: 'Reintento automático tras un fallo transitorio.' },
  { code: 'PENDING_CALLBACK', label: 'Esperando', hint: 'Make recibió la petición; falta el callback final.' },
  { code: 'SENT', label: 'Enviado', hint: 'Correo enviado correctamente.' },
  { code: 'FAILED', label: 'Error envío', hint: 'Revisa el detalle y vuelve a intentar si procede.' },
] as const;

const MODULES = [
  {
    id: 'kyc',
    title: 'KYC — Client Knowledge',
    tag: 'Comercial',
    body: 'Base de cuentas, perfil comercial, organigrama, señales y chat de investigación. Punto central para vincular otras herramientas.',
  },
  {
    id: 'pipeline',
    title: 'Pipeline Dashboard',
    tag: 'Comercial · externo',
    body: 'Pipeline de ventas, métricas y análisis por equipo y fase (datos semanales desde HubSpot). Se abre en una pestaña nueva.',
  },
  {
    id: 'rfq',
    title: 'Análisis RFQs',
    tag: 'Comercial · IA',
    body: 'Workspace por oportunidad: documentos, análisis estructurado con IA y chat sobre el mismo contexto.',
  },
  {
    id: 'meddpicc',
    title: 'MEDDPICC',
    tag: 'Comercial · IA',
    body: 'Cualificación B2B: ocho dimensiones MEDDPICC, puntuación y análisis con IA sobre el contexto del deal.',
  },
  {
    id: 'activations',
    title: 'Activaciones',
    tag: 'Administrativo',
    body: 'Dashboard, listado, nueva activación y configuración de áreas, plantillas y contactos de facturación.',
  },
  {
    id: 'yubiq',
    title: 'Yubiq Approve & Seal Filler',
    tag: 'Administrativo · IA',
    body: 'Oferta comercial en PDF → campos estructurados (cliente, importe, área Avvale) y envío a Yubiq con la extensión.',
  },
] as const;

type ExtensionProbe = 'checking' | 'yes' | 'no';

function useExtensionProbe(): ExtensionProbe {
  const [probe, setProbe] = useState<ExtensionProbe>('checking');

  useEffect(() => {
    let cancelled = false;
    void probeCompanionExtension({ timeoutMs: 800 }).then((ok) => {
      if (!cancelled) setProbe(ok ? 'yes' : 'no');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return probe;
}

function HeroExtensionPill({ probe }: { probe: ExtensionProbe }) {
  if (probe === 'checking') {
    return (
      <span className={`${styles.heroPill} ${styles.heroPillInfo}`} role="status" aria-live="polite">
        Comprobando extensión…
      </span>
    );
  }
  if (probe === 'yes') {
    return (
      <span className={`${styles.heroPill} ${styles.heroPillOk}`} role="status">
        Extensión activa en esta pestaña
      </span>
    );
  }
  return (
    <span className={`${styles.heroPill} ${styles.heroPillWarn}`} role="status">
      Extensión no detectada
    </span>
  );
}

function ExtensionStatusBanner({ probe }: { probe: ExtensionProbe }) {
  if (probe === 'checking') {
    return (
      <p className={styles.extensionProbe} role="status" aria-live="polite">
        Comprobando si la extensión responde en esta pestaña…
      </p>
    );
  }

  if (probe === 'yes') {
    return (
      <p className={`${styles.extensionProbe} ${styles.extensionProbeOk}`} role="status">
        <strong>Extensión detectada.</strong> Puedes usar importación con sesión (HubSpot) y envío a Yubiq en esta pestaña.
      </p>
    );
  }

  return (
    <p className={`${styles.extensionProbe} ${styles.extensionProbeWarn}`} role="status">
      <strong>Extensión no detectada.</strong> Instálala desde Chrome Web Store y recarga esta página. También funciona en
      Microsoft Edge.
    </p>
  );
}

function LoginIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 17L17 7M17 7H9M17 7v8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeroQuickActions({ extensionProbe }: { extensionProbe: ExtensionProbe }) {
  return (
    <aside className={styles.heroAside} aria-labelledby="hero-quick-actions-title">
      <div className={styles.heroAsideHead}>
        <p id="hero-quick-actions-title" className={styles.heroAsideLabel}>
          Acciones rápidas
        </p>
        <p className={styles.heroAsideSub}>Accede a la app o instala la extensión del navegador.</p>
      </div>
      <ul className={styles.heroCtaList}>
        <li>
          <Link
            href="/login"
            className={`${styles.heroCta} ${styles.heroCtaPrimary}`}
            aria-label="Iniciar sesión en Avvale Companion App"
          >
            <span className={styles.heroCtaIcon}>
              <LoginIcon />
            </span>
            <span className={styles.heroCtaText}>
              <span className={styles.heroCtaLabel}>Iniciar sesión</span>
              <span className={styles.heroCtaHint}>Enlace mágico o contraseña corporativa</span>
            </span>
            <span className={styles.heroCtaTrailing}>
              <ChevronRightIcon />
            </span>
          </Link>
        </li>
        <li>
          <a
            href={CHROME_WEB_STORE_COMPANION_URL}
            className={`${styles.heroCta} ${styles.heroCtaSecondary}${
              extensionProbe === 'yes' ? ` ${styles.heroCtaSecondaryActive}` : ''
            }`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instalar Avvale Companion desde Chrome Web Store (se abre en una pestaña nueva)"
          >
            <span className={`${styles.heroCtaIcon} ${styles.heroCtaIconBrowsers}`}>
              <img src="/img/browser-google-chrome.svg" alt="" width={18} height={18} decoding="async" />
              <img src="/img/browser-microsoft-edge.svg" alt="" width={18} height={18} decoding="async" />
            </span>
            <span className={styles.heroCtaText}>
              <span className={styles.heroCtaLabel}>Instalar extensión</span>
              <span className={styles.heroCtaHint}>
                {extensionProbe === 'yes'
                  ? 'Ya activa · Chrome Web Store'
                  : 'HubSpot, Yubiq y adjuntos con sesión'}
              </span>
            </span>
            <span className={styles.heroCtaTrailing}>
              <ExternalLinkIcon />
            </span>
          </a>
        </li>
      </ul>
    </aside>
  );
}

export default function AsistenciaPage() {
  const extensionProbe = useExtensionProbe();

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.hero} aria-labelledby="asistencia-hero-title">
          <div className={styles.heroPanel}>
            <div className={styles.heroInner}>
              <div className={styles.heroMain}>
                <div className={styles.heroBadges}>
                  <span className={styles.heroBadge}>Centro de asistencia</span>
                  <span className={styles.heroBadgeMuted}>Acceso público</span>
                  <HeroExtensionPill probe={extensionProbe} />
                </div>
                <h1 id="asistencia-hero-title" className={styles.heroTitle}>
                  Avvale Companion App
                </h1>
                <p className={styles.heroLead}>
                  Guía para empezar con el App Launcher, activaciones por correo, la extensión del navegador y las
                  respuestas a incidencias más habituales.
                </p>
                <ul className={styles.heroHighlights}>
                  <li>Onboarding y flujos del App Launcher</li>
                  <li>Instalación de Avvale Companion (Chrome / Edge)</li>
                  <li>FAQ y contacto de soporte</li>
                </ul>
                <a href="#inicio" className={styles.heroScroll}>
                  Explorar la guía
                  <svg className={styles.heroScrollIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M12 5v14M5 12l7 7 7-7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </a>
              </div>
              <HeroQuickActions extensionProbe={extensionProbe} />
            </div>
          </div>
        </header>

        <div className={styles.layout}>
          <nav className={styles.sidebar} aria-label="Índice de contenidos">
            <p className={styles.sidebarLabel}>En esta página</p>
            <ul className={styles.tocList}>
              {TOC.map((item) => (
                <li key={item.id}>
                  <a href={`#${item.id}`} className={styles.tocLink}>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav className={styles.tocMobile} aria-label="Índice (móvil)">
            {TOC.map((item) => (
              <a key={item.id} href={`#${item.id}`} className={styles.tocChip}>
                {item.label}
              </a>
            ))}
          </nav>

          <div className={styles.content}>
            <section id="inicio" className={styles.card} aria-label="Inicio rápido">
              <h2 className={styles.sectionTitle}>Inicio rápido</h2>
              <ol className={styles.steps}>
                <li>
                  <strong>Accede</strong> con tu correo corporativo desde{' '}
                  <Link href="/login">iniciar sesión</Link> (enlace mágico o contraseña, según tu cuenta).
                </li>
                <li>
                  <strong>Instala la extensión</strong>{' '}
                  <a href={CHROME_WEB_STORE_COMPANION_URL} target="_blank" rel="noopener noreferrer">
                    Avvale Companion
                  </a>{' '}
                  si trabajas con enlaces de HubSpot o envío a Yubiq.
                </li>
                <li>
                  <strong>Abre el Launcher</strong> y elige el módulo (Activaciones, KYC, RFQ, etc.).
                </li>
                <li>
                  <strong>Personaliza</strong> el orden de mosaicos con «Editar mis intereses» en el Launcher.
                </li>
              </ol>
            </section>

            <section id="vision" className={styles.card} aria-label="Visión general">
              <h2 className={styles.sectionTitle}>Visión general</h2>
              <p className={styles.p}>
                Avvale Companion App reúne en un único punto de acceso aplicaciones internas de Avvale: operaciones
                comerciales (KYC, pipeline, RFQ, MEDDPICC) y procesos administrativos (activaciones por correo, Yubiq).
              </p>
              <p className={styles.p}>
                Tras iniciar sesión llegarás al <span className={styles.code}>App Launcher</span>, donde cada mosaico abre
                una herramienta. Algunos módulos con IA requieren configurar tu clave de Anthropic en{' '}
                <span className={styles.code}>Perfil → AI Credentials</span>.
              </p>
            </section>

            <section id="modulos" className={styles.card} aria-label="Módulos del Launcher">
              <h2 className={styles.sectionTitle}>Módulos del App Launcher</h2>
              <p className={styles.p}>
                Los mosaicos se agrupan en <strong>herramientas comerciales</strong> y{' '}
                <strong>procesos administrativos</strong>. El orden se guarda en tu cuenta; no puedes mover un mosaico de
                una categoría a otra.
              </p>
              <ul className={styles.moduleGrid}>
                {MODULES.map((m) => (
                  <li key={m.id} className={styles.moduleCard}>
                    <span className={styles.moduleTag}>{m.tag}</span>
                    <h3 className={styles.moduleTitle}>{m.title}</h3>
                    <p className={styles.moduleBody}>{m.body}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section id="activaciones" className={styles.card} aria-label="Activaciones por correo">
              <h2 className={styles.sectionTitle}>Activaciones por correo</h2>
              <p className={styles.p}>
                Una <strong>activación</strong> es un envío de correo estructurado: proyecto u oferta, destinatarios (por
                área/subárea), asunto, cuerpo con plantilla y adjuntos. El envío se integra con Make para la entrega final.
              </p>
              <h3 className={styles.subheading}>Flujo habitual</h3>
              <ul className={styles.list}>
                <li>
                  <strong>Crear</strong>: metadatos (proyecto, cliente, código), contenido y destinatarios.
                </li>
                <li>
                  <strong>Editar</strong>: ajustar plantilla, CC manual, JP de proyecto y adjuntos.
                </li>
                <li>
                  <strong>Enviar</strong>: encola el procesamiento; el estado refleja el progreso hasta confirmación.
                </li>
                <li>
                  <strong>Dashboard</strong>: resumen de borradores, enviados y métricas del equipo.
                </li>
              </ul>
              <h3 className={styles.subheading}>Estados</h3>
              <ul className={styles.statusList}>
                {ACTIVATION_STATUSES.map((s) => (
                  <li key={s.code}>
                    <span className={styles.statusCode}>{s.label}</span>
                    <span className={styles.statusHint}>{s.hint}</span>
                  </li>
                ))}
              </ul>
              <div className={styles.note}>
                Si una activación solo incluye <strong>URLs escaneadas</strong> (p. ej. HubSpot) sin subir el fichero al
                servidor, otros usuarios o Make podrían no poder abrir esos documentos. Usa la extensión o sube archivos
                manualmente.
              </div>
            </section>

            <section id="adjuntos" className={styles.card} aria-label="Adjuntos y URLs escaneadas">
              <h2 className={styles.sectionTitle}>Adjuntos y URLs escaneadas</h2>
              <p className={styles.p}>
                En el detalle de una activación puedes gestionar <strong>URLs detectadas</strong> en el cuerpo del correo y{' '}
                <strong>archivos subidos</strong> al servidor. El objetivo es que el flujo de envío tenga ficheros accesibles
                para todos los participantes y para Make.
              </p>
              <ul className={styles.list}>
                <li>
                  <strong>Descargar localmente</strong>: abre cada URL en una pestaña para guardar el fichero y subirlo
                  después.
                </li>
                <li>
                  <strong>Añadir archivos</strong>: sube documentos desde tu equipo.
                </li>
                <li>
                  <strong>Importar con extensión</strong>: descarga con tu sesión del navegador y sube al servidor en un
                  paso (ver sección Extensión).
                </li>
                <li>
                  <strong>Eliminar adjuntos</strong>: quita ficheros ya almacenados en el servidor.
                </li>
                <li>
                  <strong>Tamaño 0 B</strong>: si un adjunto muestra 0 bytes, el fichero no se subió correctamente;
                  vuelve a importarlo.
                </li>
              </ul>
            </section>

            <section id="extension" className={styles.card} aria-label="Extensión del navegador">
              <h2 className={styles.sectionTitle}>Extensión Avvale Companion</h2>
              <p className={styles.p}>
                Para enlaces que requieren tu sesión (HubSpot, portales internos), el servidor no puede descargar el
                documento por ti. La extensión <strong>Avvale Companion</strong> descarga con tu sesión y devuelve el
                binario a la web para subirlo a la activación o completar el envío a Yubiq.
              </p>

              <ExtensionStatusBanner probe={extensionProbe} />

              <div className={styles.extensionInstall}>
                <a
                  href={CHROME_WEB_STORE_COMPANION_URL}
                  className={styles.extensionInstallBtn}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instalar Avvale Companion desde Chrome Web Store (nueva pestaña)"
                >
                  Instalar en Chrome Web Store
                </a>
                <div className={styles.extensionBrowsers} aria-hidden>
                  <img src="/img/browser-google-chrome.svg" alt="" width={22} height={22} decoding="async" />
                  <img src="/img/browser-microsoft-edge.svg" alt="" width={22} height={22} decoding="async" />
                  <span>Compatible con Chrome y Edge</span>
                </div>
              </div>

              {LAUNCHER_EXTENSION_HELP_URL ? (
                <p className={styles.p}>
                  <a className={styles.inlineLink} href={LAUNCHER_EXTENSION_HELP_URL} target="_blank" rel="noopener noreferrer">
                    Documentación interna de la extensión
                  </a>
                </p>
              ) : null}

              <h3 className={styles.subheading}>Instalación</h3>
              <ol className={styles.steps}>
                <li>
                  Pulsa <strong>Instalar en Chrome Web Store</strong> y confirma en el navegador.
                </li>
                <li>
                  Fija la extensión si lo deseas (icono de puzzle → Avvale Companion → anclar).
                </li>
                <li>
                  Inicia sesión en Companion App y, si aplica, en HubSpot en la <strong>misma pestaña</strong>.
                </li>
                <li>
                  <strong>Recarga</strong> la página de la activación antes de «Importar con extensión».
                </li>
              </ol>

              <h3 className={styles.subheading}>En Activaciones</h3>
              <ul className={styles.list}>
                <li>
                  <strong>Importar con extensión</strong>: descarga las URLs pendientes y las sube; muestra barra de
                  progreso.
                </li>
                <li>
                  <strong>Reintentar subida al flujo</strong>: si la descarga terminó pero falló la subida al servidor.
                </li>
                <li>
                  <strong>Descartar temporales</strong>: limpia el lote en la extensión tras un error o para empezar de
                  nuevo.
                </li>
              </ul>

              <h3 className={styles.subheading}>En Yubiq</h3>
              <p className={styles.p}>
                Tras analizar el PDF, la extensión puede rellenar el formulario en Yubiq con los campos extraídos. Debes
                tener sesión abierta en Yubiq en el mismo navegador.
              </p>
            </section>

            <section id="rfq" className={styles.card} aria-label="Análisis RFQ">
              <h2 className={styles.sectionTitle}>Análisis RFQs</h2>
              <p className={styles.p}>
                Workspace por oportunidad vinculado a un cliente KYC: subes documentos o conectas contexto por correo, ejecutas
                análisis con IA y conversas en un chat sobre el mismo expediente.
              </p>
              <ul className={styles.list}>
                <li>
                  <strong>Requisito</strong>: clave de API de Anthropic en Perfil (módulo bloqueado hasta configurarla).
                </li>
                <li>
                  <strong>Estados</strong>: borrador, en cola, procesando, completado o error — según el análisis en curso.
                </li>
                <li>
                  <strong>KYC</strong>: al crear un análisis puedes asociarlo a una empresa del catálogo KYC.
                </li>
              </ul>
            </section>

            <section id="yubiq" className={styles.card} aria-label="Yubiq Approve and Seal Filler">
              <h2 className={styles.sectionTitle}>Yubiq Approve &amp; Seal Filler</h2>
              <p className={styles.p}>
                Sube una oferta comercial en PDF; la IA extrae título, cliente, importes, área Avvale y resumen. Revisa los
                campos y, con la extensión instalada, envía el prefill al formulario de Yubiq.
              </p>
              <ul className={styles.list}>
                <li>
                  <strong>Requisito</strong>: clave Anthropic en Perfil y extensión activa para el envío a Yubiq.
                </li>
                <li>
                  <strong>Revisión</strong>: valida siempre los datos antes de confirmar en Yubiq.
                </li>
              </ul>
            </section>

            <section id="cuenta" className={styles.card} aria-label="Cuenta y sesión">
              <h2 className={styles.sectionTitle}>Cuenta y sesión</h2>
              <ul className={styles.list}>
                <li>
                  <strong>Acceso</strong>: enlace mágico por correo y/o contraseña, según lo habilitado para tu usuario.
                </li>
                <li>
                  <strong>Perfil</strong>: nombre, foto, apariencia (Microsoft / Fiori) y credenciales de IA.
                </li>
                <li>
                  <strong>Roles</strong>: usuarios estándar y administradores (gestión de usuarios y configuración global).
                </li>
                <li>
                  <strong>Sesión en terceros</strong>: HubSpot, Yubiq, etc. deben estar activos en el navegador donde usas
                  la extensión.
                </li>
                <li>
                  <strong>Esta página</strong>: accesible sin login para soporte y onboarding.
                </li>
              </ul>
            </section>

            <section id="faq" className={styles.card} aria-label="Problemas frecuentes">
              <h2 className={styles.sectionTitle}>Problemas frecuentes</h2>
              <div className={styles.faqList}>
                <details className={styles.faqItem}>
                  <summary>La extensión no se detecta</summary>
                  <p>
                    Comprueba que está instalada desde{' '}
                    <a href={CHROME_WEB_STORE_COMPANION_URL} target="_blank" rel="noopener noreferrer">
                      Chrome Web Store
                    </a>
                    , que no está deshabilitada para este sitio y recarga la pestaña. En Edge, instala desde la misma ficha
                    (compatible con extensiones de Chrome).
                  </p>
                </details>
                <details className={styles.faqItem}>
                  <summary>«Importar con extensión» se queda esperando</summary>
                  <p>
                    Actualiza la extensión a la última versión, recarga la página y vuelve a intentar. Si falló a medias, usa{' '}
                    <strong>Descartar temporales</strong> y reinicia el lote. Comprueba que las URLs siguen pendientes (no
                    importadas ya).
                  </p>
                </details>
                <details className={styles.faqItem}>
                  <summary>Adjuntos en 0 B o vacíos</summary>
                  <p>
                    Suele indicar que el binario no llegó desde la extensión. Descarta temporales, recarga e importa de nuevo.
                    Como alternativa, descarga manualmente la URL y súbela con «Añadir archivos».
                  </p>
                </details>
                <details className={styles.faqItem}>
                  <summary>No puedo abrir RFQ, Yubiq o MEDDPICC</summary>
                  <p>
                    Configura tu clave de API de Anthropic en Perfil → AI Credentials. Sin ella, esos mosaicos permanecen
                    bloqueados en el Launcher.
                  </p>
                </details>
                <details className={styles.faqItem}>
                  <summary>Otros no ven mis documentos de HubSpot</summary>
                  <p>
                    Las URLs escaneadas dependen de tu sesión. Importa con la extensión o sube el fichero al servidor para
                    que el equipo y Make puedan acceder.
                  </p>
                </details>
              </div>
            </section>

            <section id="contacto" className={styles.card} aria-label="Contacto">
              <h2 className={styles.sectionTitle}>Contacto</h2>
              <p className={styles.p}>
                Para incidencias o dudas de uso, escribe a{' '}
                <a className={styles.contactEmail} href={`mailto:${CONTACT_EMAIL}`}>
                  {CONTACT_EMAIL}
                </a>
                . Incluye capturas, ID de activación o análisis y el navegador que utilizas.
              </p>
              <div className={styles.contactActions}>
                <Link href="/login" className={styles.btnPrimary}>
                  Ir a iniciar sesión
                </Link>
                <a
                  href={CHROME_WEB_STORE_COMPANION_URL}
                  className={styles.btnSecondary}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Extensión en Chrome Web Store
                </a>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
