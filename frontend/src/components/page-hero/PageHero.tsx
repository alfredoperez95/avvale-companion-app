import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './page-hero.module.css';

export function PageBreadcrumb({ children }: { children: ReactNode }) {
  return (
    <nav className={styles.breadcrumb} aria-label="Migas de pan">
      {children}
    </nav>
  );
}

export function PageBackLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={className ? `${styles.back} ${className}` : styles.back}>
      {children}
    </Link>
  );
}

export function PageHero({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className={styles.hero}>
      <div className={styles.heroInner}>
        <div className={styles.heroText}>
          <h1 className={styles.h1}>{title}</h1>
          {subtitle != null && subtitle !== '' ? (
            <div className={styles.subtitle}>{subtitle}</div>
          ) : null}
        </div>
        {actions ? <div className={styles.heroActions}>{actions}</div> : null}
      </div>
    </header>
  );
}

export function ChevronBackIcon() {
  return (
    <span className={styles.backIcon} aria-hidden>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </span>
  );
}
