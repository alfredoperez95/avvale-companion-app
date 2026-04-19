'use client';

import Link from 'next/link';
import styles from './page.module.css';

const CONTACT_EMAIL = 'no-reply@avvalecompanion.app';

export default function AsistenciaPage() {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <p className={styles.kicker}>Centro de asistencia</p>
          <h1 className={styles.title}>Avvale Companion App — Guía completa</h1>
          <p className={styles.subtitle}>
            Esta página es pública (sin login) y explica en profundidad la funcionalidad principal de la aplicación.
          </p>
          <nav className={styles.toc} aria-label="Contenido">
            <a href="#vision">Visión general</a>
            <a href="#activaciones">Activaciones por correo</a>
            <a href="#adjuntos">Adjuntos y URLs</a>
            <a href="#extension">Extensión del navegador</a>
            <a href="#rfq">Análisis RFQ</a>
            <a href="#yubiq">Yubiq A&S Filler</a>
            <a href="#cuenta">Cuenta y sesión</a>
            <a href="#contacto">Contacto</a>
          </nav>
        </header>

        <section id="vision" className={styles.card} aria-label="Visión general">
          <h2 className={styles.sectionTitle}>Visión general</h2>
          <p className={styles.p}>
            Avvale Companion App es un punto de acceso unificado a herramientas internas. A nivel funcional, la app se
            organiza en módulos accesibles desde el <span className={styles.code}>Launcher</span>.
          </p>
          <ul className={styles.list}>
            <li>
              <strong>Activaciones</strong>: creación/gestión de activaciones de correo y envío al flujo.
            </li>
            <li>
              <strong>Adjuntos</strong>: subida de ficheros al servidor y asociación a activaciones.
            </li>
            <li>
              <strong>Extensión</strong>: descarga de documentos usando la sesión del navegador (por ejemplo, enlaces de
              HubSpot) y subida al flujo.
            </li>
            <li>
              <strong>RFQ Analysis</strong>: análisis asistido (IA) de correos/solicitudes (si está habilitado).
            </li>
            <li>
              <strong>Yubiq Approve &amp; Seal Filler</strong>: utilidades para extracción/relleno (si está habilitado).
            </li>
          </ul>
        </section>

        <section id="activaciones" className={styles.card} aria-label="Activaciones por correo">
          <h2 className={styles.sectionTitle}>Activaciones por correo</h2>
          <p className={styles.p}>
            Una <strong>activación</strong> representa un envío de correo estructurado (proyecto/oferta, destinatarios,
            asunto y cuerpo). El estado permite saber en qué punto está el envío (borrador, en cola, procesando, enviado,
            etc.).
          </p>
          <ul className={styles.list}>
            <li>
              <strong>Crear</strong>: se define el contenido y metadatos (proyecto, cliente, código, etc.).
            </li>
            <li>
              <strong>Editar</strong>: se ajusta el cuerpo/plantilla y destinatarios.
            </li>
            <li>
              <strong>Enviar</strong>: dispara el flujo de envío y deja trazabilidad del proceso.
            </li>
          </ul>
          <div className={styles.note}>
            Si una activación solo tiene <strong>URLs escaneadas</strong> pero no adjuntos subidos al servidor, otras
            personas podrían no poder acceder a esos documentos si requieren sesión (por ejemplo, HubSpot).
          </div>
        </section>

        <section id="adjuntos" className={styles.card} aria-label="Adjuntos y URLs escaneadas">
          <h2 className={styles.sectionTitle}>Adjuntos y URLs escaneadas</h2>
          <p className={styles.p}>
            La app puede manejar <strong>URLs</strong> (enlaces detectados/escaneados) y <strong>archivos adjuntos</strong>{' '}
            (ficheros subidos al servidor). El objetivo es que el flujo de envío tenga adjuntos consistentes y accesibles.
          </p>
          <ul className={styles.list}>
            <li>
              <strong>Descargar localmente</strong>: abre cada URL en una pestaña del navegador para que puedas guardar el
              fichero manualmente y luego subirlo.
            </li>
            <li>
              <strong>Añadir archivos</strong>: sube ficheros desde tu equipo a la activación.
            </li>
            <li>
              <strong>Eliminar adjuntos</strong>: borra los ficheros ya subidos al servidor para esa activación.
            </li>
            <li>
              <strong>Tamaño</strong>: la lista de adjuntos muestra el tamaño en el servidor para validar que el fichero
              no está vacío (0 B).
            </li>
          </ul>
        </section>

        <section id="extension" className={styles.card} aria-label="Extensión del navegador">
          <h2 className={styles.sectionTitle}>Extensión del navegador (importación con sesión)</h2>
          <p className={styles.p}>
            Para enlaces que requieren autenticación del usuario (por ejemplo, HubSpot), el servidor no puede descargar
            el documento. En esos casos, la app usa una <strong>extensión del navegador</strong> que descarga con tu sesión
            y devuelve el binario a la web para subirlo al servidor. La extensión <strong>Avvale Companion</strong> está en{' '}
            <strong>Chrome Web Store</strong> y es <strong>100% compatible con Microsoft Edge</strong> (mismo motor
            Chromium que Chrome).
          </p>
          <ul className={styles.list}>
            <li>
              <strong>Importar con extensión</strong>: ejecuta un flujo en un paso (descarga + subida) y muestra progreso.
            </li>
            <li>
              <strong>Descartar temporales</strong>: elimina archivos guardados temporalmente por la extensión si hubo un
              error o quieres reiniciar el lote.
            </li>
            <li>
              <strong>Diagnóstico</strong>: si el progreso se queda esperando, puede faltar implementación del puente de
              eventos o estar desactualizada la extensión.
            </li>
          </ul>
        </section>

        <section id="rfq" className={styles.card} aria-label="Análisis RFQ">
          <h2 className={styles.sectionTitle}>RFQ Analysis</h2>
          <p className={styles.p}>
            El módulo de análisis RFQ está orientado a estructurar información de entradas (por ejemplo correos o
            solicitudes) y presentar resultados de forma operativa. La disponibilidad exacta depende de la configuración
            del entorno.
          </p>
        </section>

        <section id="yubiq" className={styles.card} aria-label="Yubiq Approve & Seal Filler">
          <h2 className={styles.sectionTitle}>Yubiq Approve &amp; Seal Filler</h2>
          <p className={styles.p}>
            Utilidades para extracción/transformación de contenido relacionado con Yubiq. La app guía el proceso y aplica
            reglas/prompting interno según el tipo de documento y el flujo configurado.
          </p>
        </section>

        <section id="cuenta" className={styles.card} aria-label="Cuenta y sesión">
          <h2 className={styles.sectionTitle}>Cuenta y sesión</h2>
          <ul className={styles.list}>
            <li>
              <strong>Acceso</strong>: se realiza mediante cuenta corporativa según el método habilitado (enlace mágico y/o
              contraseña).
            </li>
            <li>
              <strong>Sesión</strong>: algunas funciones (como la extensión) requieren que el usuario esté autenticado en
              los servicios origen (p. ej. HubSpot) en el navegador.
            </li>
            <li>
              <strong>Sin login</strong>: esta página de asistencia está disponible públicamente para soporte y onboarding.
            </li>
          </ul>
        </section>

        <section id="contacto" className={styles.card} aria-label="Contacto">
          <h2 className={styles.sectionTitle}>Contacto</h2>
          <div className={styles.contactRow}>
            <p className={styles.p} style={{ margin: 0 }}>
              Si necesitas ayuda, escribe a <a className={styles.contactEmail} href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
            <Link href="/login" className={styles.backLink}>
              Volver a iniciar sesión
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

