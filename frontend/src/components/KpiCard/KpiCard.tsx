'use client';

import Link from 'next/link';
import { Icon, type IconName } from '@/components/Icon/Icon';
import styles from './KpiCard.module.css';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  href?: string;
  icon?: IconName;
}

export function KpiCard({ title, value, subtitle, href, icon }: KpiCardProps) {
  const content = (
    <>
      <div className={styles.header}>
        {icon && <Icon name={icon} size={28} className={styles.icon} />}
        <div className={styles.title}>{title}</div>
      </div>
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
