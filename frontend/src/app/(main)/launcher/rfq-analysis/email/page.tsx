'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageBreadcrumb, PageHero, PageBackLink, ChevronBackIcon } from '@/components/page-hero';
import styles from '../rfq-analysis.module.css';

export default function RfqAnalysisEmailFlowPage() {
  const [webhookUrl, setWebhookUrl] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setWebhookUrl(`${window.location.origin}/api/webhooks/rfq-email/inbound`);
  }, []);

  const jsonExample = `{
  "secret": "<RFQ_EMAIL_WEBHOOK_SECRET>",
  "fromEmail": "usuario@empresa.com",
  "subject": "RFP proyecto SAP",
  "bodyPlain": "Texto del correo…",
  "threadContext": "Resumen opcional del hilo…",
  "attachments": [
    {
      "fileName": "requisitos.pdf",
      "mimeType": "application/pdf",
      "contentBase64": "<base64>"
    }
  ]
}`;

  return (
    <main className={styles.page}>
      <PageBreadcrumb>
        <PageBackLink href="/launcher/rfq-analysis">
          <ChevronBackIcon />
          Análisis RFQs
        </PageBackLink>
      </PageBreadcrumb>
      <PageHero
        title="Análisis por email (Make)"
        subtitle="Recibe RFPs en un buzón y crea workspaces automáticamente cuando un escenario de Make reenvía el mensaje al webhook del backend."
      />

      <section className={`${styles.sectionCard} ${styles.emailFlowSection}`} aria-labelledby="email-flow-how">
        <h2 id="email-flow-how" className={styles.sectionHeading}>
          Cómo encaja en el producto
        </h2>
        <div className={styles.sectionBody}>
          <ol className={styles.emailFlowSteps}>
            <li>
              <strong>Remitente = usuario registrado.</strong> El campo <code className={styles.emailFlowCodeInline}>fromEmail</code>{' '}
              debe coincidir con el email de una cuenta en Companion Apps (mismo dominio o correo que usas para iniciar sesión).
            </li>
            <li>
              <strong>Clave Anthropic.</strong> Ese usuario debe tener guardada su API key de Anthropic (como en Yubiq); si no, el
              webhook responde <code className={styles.emailFlowCodeInline}>no_anthropic_key</code> y no se procesa.
            </li>
            <li>
              <strong>Secreto compartido.</strong> En el backend, define <code className={styles.emailFlowCodeInline}>RFQ_EMAIL_WEBHOOK_SECRET</code> y envía el mismo valor en cada JSON en{' '}
              <code className={styles.emailFlowCodeInline}>secret</code>.
            </li>
            <li>
              <strong>Make (o similar).</strong> Trigger por correo entrante → módulo HTTP POST al webhook con cuerpo, adjuntos en
              base64 y asunto.
            </li>
            <li>
              <strong>Cola.</strong> Si hay contenido (cuerpo, hilo o al menos un adjunto), se crea el análisis con origen{' '}
              <em>Email</em> y se encola el pipeline en BullMQ (Redis).
            </li>
          </ol>
          <p className={styles.emailFlowNote}>
            Detalle técnico, límites de tamaño y códigos de respuesta: archivo{' '}
            <code className={styles.emailFlowCodeInline}>docs/RFQ_EMAIL_MAKE.md</code> en el repositorio.
          </p>
        </div>
      </section>

      <section className={`${styles.sectionCard} ${styles.emailFlowSection}`} aria-labelledby="email-flow-url">
        <h2 id="email-flow-url" className={styles.sectionHeading}>
          URL del webhook (esta instalación)
        </h2>
        <div className={styles.sectionBody}>
          <p className={styles.emailFlowLead}>
            Usa esta URL en Make como destino del módulo HTTP (método <strong>POST</strong>, cuerpo JSON):
          </p>
          <pre className={styles.emailFlowPre} tabIndex={0}>
            {webhookUrl || '…'}
          </pre>
          <p className={styles.emailFlowHint}>
            En desarrollo local, el frontend en <code className={styles.emailFlowCodeInline}>:3000</code> reescribe{' '}
            <code className={styles.emailFlowCodeInline}>/api/*</code> al backend en <code className={styles.emailFlowCodeInline}>:4000</code>. En
            producción, sustituye el origen por tu dominio público.
          </p>
        </div>
      </section>

      <section className={`${styles.sectionCard} ${styles.emailFlowSection}`} aria-labelledby="email-flow-payload">
        <h2 id="email-flow-payload" className={styles.sectionHeading}>
          Cuerpo JSON (referencia)
        </h2>
        <div className={styles.sectionBody}>
          <pre className={styles.emailFlowPre} tabIndex={0}>
            {jsonExample}
          </pre>
          <p className={styles.emailFlowHint}>
            Si no hay cuerpo, hilo ni adjuntos, el análisis queda fallido con motivo{' '}
            <code className={styles.emailFlowCodeInline}>no_content</code>. Asegura al menos una fuente útil en el correo o adjuntos.
          </p>
        </div>
      </section>

      <p className={styles.emailFlowFooterActions}>
        <Link href="/launcher/rfq-analysis/new" className={styles.primaryBtn}>
          Crear análisis manual
        </Link>
        <Link href="/launcher/rfq-analysis" className={styles.secondaryBtn}>
          Volver al listado
        </Link>
      </p>
    </main>
  );
}
