'use client';

import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer} role="contentinfo">
      <div className={styles.footerInner}>
        <span className={styles.copyright}>
          Copyright © 2026 Avvale. Todos los derechos reservados.
        </span>
      </div>
    </footer>
  );
}
