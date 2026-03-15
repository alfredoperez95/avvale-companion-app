'use client';

import Image from 'next/image';
import Link from 'next/link';
import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer} role="contentinfo">
      <div className={styles.footerInner}>
        <Link href="/launcher" className={styles.logoLink} aria-label="Avvale - Ir al inicio">
          <Image
            src="https://www.avvale.com/hubfs/avvale-logo-hor-col-neg-1.png"
            alt="Avvale"
            width={120}
            height={27}
            className={styles.logoImage}
          />
        </Link>
      </div>
    </footer>
  );
}
