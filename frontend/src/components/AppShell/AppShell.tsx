'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import styles from './AppShell.module.css';

const navItems = [
  { href: '/dashboard', label: 'Inicio' },
  { href: '/activations', label: 'Activaciones' },
  { href: '/activations/new', label: 'Nueva activación' },
];
const adminNavItem = { href: '/admin', label: 'Configuración' };

function getInitials(name?: string | null, lastName?: string | null, email?: string): string {
  const n = (name ?? '').trim();
  const l = (lastName ?? '').trim();
  if (n && l) return `${n[0]}${l[0]}`.toUpperCase();
  if (n && n.length >= 2) return n.slice(0, 2).toUpperCase();
  if (n) return n[0].toUpperCase();
  const e = (email ?? '').trim();
  if (e.length >= 2) return e.slice(0, 2).toUpperCase();
  if (e) return e[0].toUpperCase();
  return '?';
}

interface AppShellProps {
  children: React.ReactNode;
  user?: { id: string; email: string; name?: string | null; lastName?: string | null; role?: string } | null;
  theme?: 'microsoft' | 'fiori';
}

export function AppShell({ children, user, theme = 'microsoft' }: AppShellProps) {
  const pathname = usePathname();
  const initials = user ? getInitials(user.name, user.lastName, user.email) : '';

  return (
    <div className={styles.shell} data-theme={theme}>
      <header className={styles.header} role="banner">
        <Link href="/dashboard" className={styles.logoLink} aria-label="Ir al inicio">
          <Image
            src="https://www.avvale.com/hubfs/avvale-logo-hor-col-neg-1.png"
            alt="Avvale"
            width={160}
            height={36}
            className={styles.logoImage}
            priority
          />
        </Link>
        <span className={styles.appName} aria-label="Nombre de la aplicación">
          Activaciones
        </span>
        <div className={styles.headerRight}>
          {user && (
            <Link href="/perfil" className={styles.avatarLink} aria-label="Ir a mi perfil">
              <span className={styles.avatar} aria-hidden="true">
                {initials}
              </span>
            </Link>
          )}
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
          {user?.role === 'ADMIN' && (
            <Link
              href={adminNavItem.href}
              className={pathname === adminNavItem.href || pathname?.startsWith(adminNavItem.href + '/') ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink}
            >
              {adminNavItem.label}
            </Link>
          )}
        </aside>
        <main className={styles.main} id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
