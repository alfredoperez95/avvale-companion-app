'use client';

import Link from 'next/link';
import styles from './KpiCard.module.css';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  href?: string;
}

export function KpiCard({ title, value, subtitle, href }: KpiCardProps) {
  const content = (
    <>
      <div className={styles.title}>{title}</div>
      <div className={styles.value}>{value}</div>
      {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={styles.card} style={{ textDecoration: 'none', color: 'inherit' }}>
        {content}
      </Link>
    );
  }

  return <div className={styles.card}>{content}</div>;
}
