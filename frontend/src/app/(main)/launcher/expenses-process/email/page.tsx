'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageBreadcrumb, PageBackLink, PageHero } from '@/components/page-hero';
import styles from '../expenses-process.module.css';

export default function ExpenseEmailFlowPage() {
  const [webhookUrl, setWebhookUrl] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setWebhookUrl(`${window.location.origin}/api/webhooks/expense-email/inbound`);
  }, []);

  const jsonExample = `{
  "secret": "<EXPENSE_EMAIL_WEBHOOK_SECRET>",
  "fromEmail": "usuario@empresa.com",
  "subject": "Gastos viaje Madrid",
  "bodyPlain": "Recibos del viaje para procesar.",
  "threadContext": "Contexto opcional del hilo.",
  "attachments": [
    {
      "fileName": "taxi.pdf",
      "contentBase64": "<base64>",
      "contentType": "application/pdf"
    },
    {
      "fileName": "comida.jpg",
      "contentBase64": "<base64>",
      "contentType": "image/jpeg"
    }
  ]
}`;

  return (
    <main className={styles.page}>
      <div className={styles.pageIntro}>
        <PageBreadcrumb>
          <PageBackLink href="/launcher/expenses-process">← Gastos</PageBackLink>
        </PageBreadcrumb>
        <PageHero
          animateEnter={false}
          title="Gastos por email (Make)"
          subtitle="Recibe recibos en un buzón y crea gastos automáticamente cuando Make reenvía el correo al webhook del backend."
        />
      </div>

      <section className={styles.emailFlowCard} aria-labelledby="expense-email-how">
        <h2 id="expense-email-how" className={styles.sectionTitle}>
          Cómo encaja en el producto
        </h2>
        <ol className={styles.emailFlowSteps}>
          <li>
            <strong>Remitente = usuario registrado.</strong> El campo <code>fromEmail</code> debe coincidir con el email de una
            cuenta en Companion App.
          </li>
          <li>
            <strong>Clave Anthropic.</strong> Ese usuario debe tener guardada su API key; si no, el webhook responde{' '}
            <code>no_anthropic_key</code>.
          </li>
          <li>
            <strong>Secreto compartido.</strong> Define <code>EXPENSE_EMAIL_WEBHOOK_SECRET</code> en el backend y envía el mismo
            valor en <code>secret</code>.
          </li>
          <li>
            <strong>Un gasto por adjunto válido.</strong> Cada PDF, JPG, PNG o HEIC crea un gasto y encola la extracción IA en
            background.
          </li>
        </ol>
      </section>

      <section className={styles.emailFlowCard} aria-labelledby="expense-email-url">
        <h2 id="expense-email-url" className={styles.sectionTitle}>
          URL del webhook (esta instalación)
        </h2>
        <p className={styles.sectionLead}>
          Usa esta URL en Make como destino del módulo HTTP (método <strong>POST</strong>, cuerpo JSON):
        </p>
        <pre className={styles.emailFlowPre} tabIndex={0}>
          {webhookUrl || '...'}
        </pre>
      </section>

      <section className={styles.emailFlowCard} aria-labelledby="expense-email-payload">
        <h2 id="expense-email-payload" className={styles.sectionTitle}>
          Cuerpo JSON (referencia)
        </h2>
        <pre className={styles.emailFlowPre} tabIndex={0}>
          {jsonExample}
        </pre>
        <p className={styles.sectionLead}>
          Si el correo no contiene adjuntos válidos, el webhook responde <code>no_valid_attachments</code>. Los adjuntos no
          soportados se devuelven en <code>skipped</code> cuando hay otros recibos válidos.
        </p>
      </section>

      <p className={styles.emailFlowActions}>
        <Link href="/launcher/expenses-process/expenses" className={styles.btnPrimary}>
          Ver gastos
        </Link>
        <Link href="/launcher/expenses-process" className={styles.btnSecondary}>
          Volver
        </Link>
      </p>
    </main>
  );
}
