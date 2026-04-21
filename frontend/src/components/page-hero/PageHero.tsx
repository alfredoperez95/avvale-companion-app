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
  meta,
  actions,
  actionsClassName,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Contenido adicional bajo el subtítulo (p. ej. fechas o metadatos). */
  meta?: ReactNode;
  actions?: ReactNode;
  /** Clase opcional en el contenedor de acciones (p. ej. alineación). */
  actionsClassName?: string;
}) {
  return (
    <header className={styles.hero}>
      <div className={styles.heroInner}>
        <div className={styles.heroText}>
          <h1 className={styles.h1}>{title}</h1>
          {subtitle != null && subtitle !== '' ? (
            <div className={styles.subtitle}>{subtitle}</div>
          ) : null}
          {meta != null && meta !== '' ? <div className={styles.heroMeta}>{meta}</div> : null}
        </div>
        {actions ? (
          <div className={actionsClassName ? `${styles.heroActions} ${actionsClassName}` : styles.heroActions}>{actions}</div>
        ) : null}
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
