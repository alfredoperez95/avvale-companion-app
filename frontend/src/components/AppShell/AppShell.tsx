'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './AppShell.module.css';

const navItems = [
  { href: '/dashboard', label: 'Inicio' },
  { href: '/activations', label: 'Activaciones' },
  { href: '/activations/new', label: 'Nueva activación' },
];

interface AppShellProps {
  children: React.ReactNode;
  user?: { email: string } | null;
}

export function AppShell({ children, user }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className={styles.shell}>
      <header className={styles.header} role="banner">
        <span className={styles.logo}>Activaciones</span>
        <div className={styles.headerRight}>
          {user?.email && <span aria-label="Usuario">{user.email}</span>}
        </div>
      </header>
      <div className={styles.body}>
        <aside className={styles.nav} aria-label="Navegación lateral">
          {navItems.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={pathname === href || (href !== '/dashboard' && pathname?.startsWith(href)) ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink}
            >
              {label}
            </Link>
          ))}
        </aside>
        <main className={styles.main} id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
