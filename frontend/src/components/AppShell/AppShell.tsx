'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { type IconName } from '@/components/Icon/Icon';
import styles from './AppShell.module.css';

const navItems: { href: string; label: string; icon: IconName }[] = [
  { href: '/dashboard', label: 'Inicio', icon: 'home' },
  { href: '/activations', label: 'Activaciones', icon: 'activations' },
  { href: '/activations/new', label: 'Nueva activación', icon: 'new' },
];
const adminNavItem = { href: '/admin', label: 'Configuración', icon: 'settings' as IconName };

/** Tabs para tema Fiori: Casa (solo icono, sin enlace), Launchpad, Nueva activación, Mis activaciones, Configuración */
const fioriTabs: {
  href: string;
  label: string;
  icon?: IconName;
  iconOnly?: boolean;
  isActive: (pathname: string | null) => boolean;
}[] = [
  { href: '#', label: 'Inicio', icon: 'home', iconOnly: true, isActive: () => false },
  { href: '/dashboard', label: 'Launchpad', isActive: (p) => p === '/dashboard' },
  { href: '/activations/new', label: 'Nueva activación', isActive: (p) => p === '/activations/new' },
  { href: '/activations', label: 'Mis activaciones', isActive: (p) => p === '/activations' || (p != null && p.startsWith('/activations/') && !p.startsWith('/activations/new')) },
  { href: '/admin', label: 'Configuración', isActive: (p) => p === '/admin' || (p != null && p.startsWith('/admin/')) },
];

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
        {theme === 'fiori' ? (
          <>
            <nav className={styles.tabsNav} aria-label="Navegación principal">
              {fioriTabs
                .filter((tab) => tab.href !== '/admin' || user?.role === 'ADMIN')
                .map((tab) => {
                  const { href, label, icon, iconOnly, isActive } = tab;
                  const active = isActive(pathname);
                  const tabClass = active ? `${styles.tabLink} ${styles.tabLinkActive}` : styles.tabLink;
                  if (iconOnly && icon === 'home') {
                    return (
                      <span
                        key="home"
                        className={tabClass}
                        role="button"
                        aria-label={label}
                        style={{ cursor: 'default' }}
                      >
                        <span className={`${styles.tabIcon} sap-icon sap-icon--launchpad`} style={{ fontSize: 18 }} aria-hidden />
                      </span>
                    );
                  }
                  return (
                    <Link key={href} href={href} className={tabClass}>
                      {label}
                    </Link>
                  );
                })}
            </nav>
            <main className={styles.main} id="main-content">
              {children}
            </main>
          </>
        ) : (
          <>
            <aside className={styles.nav} aria-label="Navegación lateral">
              {navItems.map(({ href, label, icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={pathname === href || (href !== '/dashboard' && pathname?.startsWith(href)) ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink}
                >
                  <Icon name={icon} size={20} className={styles.navIcon} />
                  {label}
                </Link>
              ))}
              {user?.role === 'ADMIN' && (
                <Link
                  href={adminNavItem.href}
                  className={pathname === adminNavItem.href || pathname?.startsWith(adminNavItem.href + '/') ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink}
                >
                  <Icon name={adminNavItem.icon} size={20} className={styles.navIcon} />
                  {adminNavItem.label}
                </Link>
              )}
            </aside>
            <main className={styles.main} id="main-content">
              {children}
            </main>
          </>
        )}
      </div>
    </div>
  );
}
