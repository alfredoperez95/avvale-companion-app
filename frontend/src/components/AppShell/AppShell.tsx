'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Footer } from '@/components/Footer/Footer';
import { Icon, type IconName } from '@/components/Icon/Icon';
import styles from './AppShell.module.css';

const navItems: { href: string; label: string; icon: IconName }[] = [
  { href: '/launcher', label: 'App Launcher', icon: 'home' },
  { href: '/launcher/activations/dashboard', label: 'Dashboard', icon: 'activations' },
  { href: '/launcher/activations/activate', label: 'Mis activaciones', icon: 'activations' },
  { href: '/launcher/activations/activate/new', label: 'Nueva activación', icon: 'new' },
];
const adminNavItem = { href: '/launcher/activations/configuration', label: 'Configuración', icon: 'settings' as IconName };

/** Tabs para tema Fiori: App Launcher (Inicio), Dashboard, Nueva activación, Mis activaciones, Configuración */
const fioriTabs: {
  href: string;
  label: string;
  icon?: IconName;
  iconOnly?: boolean;
  isActive: (pathname: string | null) => boolean;
}[] = [
  { href: '/launcher', label: 'Inicio', icon: 'home', iconOnly: true, isActive: (p) => p === '/launcher' },
  { href: '/launcher/activations/dashboard', label: 'Dashboard', isActive: (p) => p === '/launcher/activations/dashboard' },
  { href: '/launcher/activations/activate/new', label: 'Nueva activación', isActive: (p) => p === '/launcher/activations/activate/new' },
  { href: '/launcher/activations/activate', label: 'Mis activaciones', isActive: (p) => p === '/launcher/activations/activate' || (p != null && p.startsWith('/launcher/activations/activate/') && p !== '/launcher/activations/activate/new') },
  { href: '/launcher/activations/configuration', label: 'Configuración', isActive: (p) => p === '/launcher/activations/configuration' || (p != null && p.startsWith('/launcher/activations/configuration/')) },
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

/** Título para la barra "dónde estás" (solo Fiori); App Launcher, Activaciones, Configuración */
function getPageHeader(pathname: string | null): { title: string } {
  if (!pathname) return { title: 'Inicio' };
  if (pathname === '/launcher') return { title: 'Inicio' };
  if (pathname === '/launcher/activations/dashboard') return { title: 'Activaciones' };
  if (pathname.startsWith('/launcher/activations/activate')) return { title: 'Activaciones' };
  if (pathname.startsWith('/launcher/activations/configuration')) return { title: 'Configuración' };
  return { title: 'Activaciones' };
}

interface AppShellProps {
  children: React.ReactNode;
  user?: { id: string; email: string; name?: string | null; lastName?: string | null; role?: string } | null;
  theme?: 'microsoft' | 'fiori';
}

export function AppShell({ children, user, theme = 'microsoft' }: AppShellProps) {
  const pathname = usePathname();
  const initials = user ? getInitials(user.name, user.lastName, user.email) : '';
  const pageHeader = getPageHeader(pathname);

  return (
    <div className={styles.shell} data-theme={theme}>
      <header className={styles.header} role="banner">
        <div className={styles.headerInner}>
          <Link href="/launcher" className={styles.logoLink} aria-label="Ir al inicio">
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
            Companion Apps
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
        </div>
      </header>
      <div className={styles.body}>
        {theme === 'fiori' ? (
          <>
            {pathname !== '/launcher' && pathname !== '/perfil' && (
              <>
                <div className={styles.pageHeader}>
                  <div className={styles.pageHeaderInner}>
                    <h1 className={styles.pageHeaderTitle}>{pageHeader.title}</h1>
                  </div>
                </div>
                <nav className={styles.tabsNav} aria-label="Navegación principal">
                  <div className={styles.tabsNavInner}>
                    {fioriTabs
                      .filter((tab) => tab.href !== '/launcher/activations/configuration' || user?.role === 'ADMIN')
                      .map((tab) => {
                        const { href, label, icon, iconOnly, isActive } = tab;
                        const active = isActive(pathname);
                        const tabClass = active ? `${styles.tabLink} ${styles.tabLinkActive}` : styles.tabLink;
                        if (iconOnly && icon === 'home') {
                          return (
                            <Link key={href} href={href} className={tabClass} aria-label={label}>
                              <span className={`${styles.tabIcon} sap-icon sap-icon--launchpad`} style={{ fontSize: 18 }} aria-hidden />
                            </Link>
                          );
                        }
                        return (
                          <Link key={href} href={href} className={tabClass}>
                            {label}
                          </Link>
                        );
                      })}
                  </div>
                </nav>
              </>
            )}
            <div className={styles.mainFooterWrap}>
              <main className={styles.main} id="main-content">
                {children}
              </main>
              <Footer />
            </div>
          </>
        ) : (
          <>
            <aside className={styles.nav} aria-label="Navegación lateral">
              {navItems.map(({ href, label, icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={pathname === href || (href !== '/launcher' && href !== '/launcher/activations/dashboard' && pathname?.startsWith(href)) ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink}
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
            <div className={styles.mainFooterWrap}>
              <main className={styles.main} id="main-content">
                {children}
              </main>
              <Footer />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
