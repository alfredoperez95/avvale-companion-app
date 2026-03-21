'use client';

import Link from 'next/link';
import { Icon, type IconName } from '@/components/Icon/Icon';
import { useTheme } from '@/contexts/ThemeContext';
import styles from './KpiCard.module.css';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  href?: string;
  icon?: IconName;
  loading?: boolean;
}

export function KpiCard({ title, value, subtitle, href, icon, loading = false }: KpiCardProps) {
  const theme = useTheme();
  const isMicrosoft = theme === 'microsoft';
  const isFiori = theme === 'fiori';
  const valueNode = loading ? <span className={styles.valueSkeleton} aria-hidden="true" /> : value;

  const content = isMicrosoft ? (
    <>
      <div className={styles.topRow}>
        {icon && (
          <span className={styles.iconWrap}>
            <Icon name={icon} size={24} className={styles.icon} />
          </span>
        )}
        <div className={styles.value}>{valueNode}</div>
      </div>
      <div className={styles.bottomLabel}>{title}</div>
      {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
    </>
  ) : isFiori ? (
    <>
      <div className={styles.titleTop}>{title}</div>
      <div className={styles.topRow}>
        {icon && (
          <span className={styles.iconWrap}>
            <Icon name={icon} size={32} className={styles.icon} />
          </span>
        )}
        <div className={styles.value}>{valueNode}</div>
      </div>
      {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
    </>
  ) : (
    <>
      <div className={styles.header}>
        {icon && (
          <span className={styles.iconWrap}>
            <Icon name={icon} size={24} className={styles.icon} />
          </span>
        )}
        <div className={styles.title}>{title}</div>
      </div>
      <div className={styles.value}>{valueNode}</div>
      {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
    </>
  );

  const cardClass = icon ? `${styles.card} ${styles.cardWithIcon}` : styles.card;
  const cardProps = { className: cardClass, 'data-variant': icon ?? undefined };

  if (href) {
    return (
      <Link href={href} {...cardProps} style={{ textDecoration: 'none', color: 'inherit' }}>
        {content}
      </Link>
    );
  }

  return <div {...cardProps}>{content}</div>;
}
