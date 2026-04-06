'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Footer } from '@/components/Footer/Footer';
import { Icon, type IconName } from '@/components/Icon/Icon';
import { useAvatarUrl } from '@/hooks/useAvatarUrl';
import { clearAppearanceCookie } from '@/lib/appearance-cookie';
import { redirectToLogin } from '@/lib/api';
import styles from './AppShell.module.css';

const navItems: { href: string; label: string; icon: IconName }[] = [
  { href: '/launcher', label: 'App Launcher', icon: 'home' },
  { href: '/launcher/activations/dashboard', label: 'Dashboard', icon: 'activations' },
  { href: '/launcher/activations/activate', label: 'Mis activaciones', icon: 'activations' },
  { href: '/launcher/activations/activate/new', label: 'Nueva activación', icon: 'new' },
];
const adminNavItem = { href: '/launcher/activations/configuration', label: 'Configuración', icon: 'settings' as IconName };
const adminUsersNavItem = { href: '/admin', label: 'Gestión de usuarios', icon: 'settings' as IconName };

/** Tabs del aplicativo activaciones (tema Fiori): Inicio, Dashboard, Nueva activación, Mis activaciones, Configuración. En /launcher/yubiq/* solo Inicio + pestaña de la herramienta Yubiq (fioriTabsYubiq). */
const fioriTabsActivations: {
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

/** Tab común: icono Inicio para volver al App Launcher (siempre visible en tabsNavInner) */
const fioriTabHome = { href: '/launcher', label: 'Inicio', icon: 'home' as IconName, iconOnly: true, isActive: (p: string | null) => p === '/launcher' };

/** Tabs del aplicativo admin (tema Fiori): Inicio (común) + Gestión de usuarios */
const fioriTabsAdmin: {
  href: string;
  label: string;
  icon?: IconName;
  iconOnly?: boolean;
  isActive: (pathname: string | null) => boolean;
}[] = [
  fioriTabHome,
  { href: '/admin', label: 'Gestión de usuarios', isActive: (p) => p != null && p.startsWith('/admin') },
];

/** Tabs en /profile (Fiori): Inicio + Mi perfil */
const fioriTabsProfile: {
  href: string;
  label: string;
  icon?: IconName;
  iconOnly?: boolean;
  isActive: (pathname: string | null) => boolean;
}[] = [
  fioriTabHome,
  { href: '/profile', label: 'Mi perfil', isActive: (p) => p === '/profile' },
];

/** Tabs en /launcher/yubiq/* (Fiori): Inicio + herramienta actual (sin Dashboard de Activaciones) */
const fioriTabsYubiq: {
  href: string;
  label: string;
  icon?: IconName;
  iconOnly?: boolean;
  isActive: (pathname: string | null) => boolean;
}[] = [
  fioriTabHome,
  {
    href: '/launcher/yubiq/approve-seal-filler',
    label: 'Yubiq Approve & Seal Filler',
    isActive: (p) => p != null && p.startsWith('/launcher/yubiq/approve-seal-filler'),
  },
];

const fioriTabsRfqAnalysis: {
  href: string;
  label: string;
  icon?: IconName;
  iconOnly?: boolean;
  isActive: (pathname: string | null) => boolean;
}[] = [
  fioriTabHome,
  {
    href: '/launcher/rfq-analysis',
    label: 'Análisis RFQs',
    isActive: (p) => p != null && p.startsWith('/launcher/rfq-analysis'),
  },
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
  if (pathname === '/profile') return { title: 'Mi cuenta' };
  if (pathname === '/launcher/activations/dashboard') return { title: 'Activaciones' };
  if (pathname.startsWith('/launcher/yubiq/approve-seal-filler')) {
    return { title: 'Yubiq Tools' };
  }
  if (pathname.startsWith('/launcher/yubiq')) return { title: 'Yubiq' };
  if (pathname.startsWith('/launcher/rfq-analysis')) return { title: 'Análisis RFQs' };
  if (pathname.startsWith('/launcher/activations/activate')) return { title: 'Activaciones' };
  if (pathname.startsWith('/launcher/activations/configuration')) return { title: 'Configuración' };
  if (pathname.startsWith('/admin')) return { title: 'Administración' };
  return { title: 'Activaciones' };
}

interface AppShellProps {
  children: React.ReactNode;
  user?: { id: string; email: string; name?: string | null; lastName?: string | null; position?: string | null; avatarPath?: string | null; role?: string } | null;
  theme?: 'microsoft' | 'fiori';
}

export function AppShell({ children, user, theme = 'microsoft' }: AppShellProps) {
  const pathname = usePathname();
  const initials = user ? getInitials(user.name, user.lastName, user.email) : '';
  const avatarUrl = useAvatarUrl(user?.avatarPath ?? null);
  const pageHeader = getPageHeader(pathname);
  const fioriTabs =
    pathname === '/profile'
      ? fioriTabsProfile
      : pathname?.startsWith('/admin')
        ? fioriTabsAdmin
        : pathname?.startsWith('/launcher/rfq-analysis')
          ? fioriTabsRfqAnalysis
          : pathname?.startsWith('/launcher/yubiq')
            ? fioriTabsYubiq
            : fioriTabsActivations;
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!avatarMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        setAvatarMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [avatarMenuOpen]);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      clearAppearanceCookie();
      redirectToLogin();
    }
  };

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
              <div className={styles.avatarMenu} ref={avatarMenuRef}>
                <button
                  type="button"
                  className={styles.avatarTrigger}
                  onClick={(e) => { e.preventDefault(); setAvatarMenuOpen((v) => !v); }}
                  aria-expanded={avatarMenuOpen}
                  aria-haspopup="true"
                  aria-label="Menú de cuenta"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className={styles.avatarImage} aria-hidden />
                  ) : (
                    <span className={styles.avatar} aria-hidden="true">
                      {initials}
                    </span>
                  )}
                </button>
                {avatarMenuOpen && (
                  <div className={styles.avatarDropdown} role="menu">
                    <div className={styles.avatarDropdownHeader}>
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="" className={`${styles.avatarDropdownAvatar} ${styles.avatarDropdownAvatarImage}`} aria-hidden />
                      ) : (
                        <span className={styles.avatarDropdownAvatar} aria-hidden="true">
                          {initials}
                        </span>
                      )}
                      <div className={styles.avatarDropdownName}>
                        {[user.name, user.lastName].filter(Boolean).join(' ') || user.email || 'Usuario'}
                      </div>
                      <div className={styles.avatarDropdownPosition}>
                        {user.position?.trim() || '—'}
                      </div>
                      <div className={styles.avatarDropdownEmail}>{user.email}</div>
                    </div>
                    <div className={styles.avatarDropdownDivider} />
                    <Link
                      href="/profile"
                      className={styles.avatarDropdownItem}
                      role="menuitem"
                      onClick={() => setAvatarMenuOpen(false)}
                    >
                      Mi cuenta
                    </Link>
                    <div className={styles.avatarDropdownDivider} />
                    <button
                      type="button"
                      className={styles.avatarDropdownItem}
                      role="menuitem"
                      onClick={handleLogout}
                    >
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>
      <div className={styles.body}>
        {theme === 'fiori' ? (
          <>
            {pathname !== '/launcher' && (
              <>
                <div className={styles.pageHeader}>
                  <div className={styles.pageHeaderInner}>
                    <h1 className={styles.pageHeaderTitle}>{pageHeader.title}</h1>
                  </div>
                </div>
                <div className={styles.tabsNavWrap}>
                  <nav className={styles.tabsNav} aria-label="Navegación principal">
                    <div className={styles.tabsNavInner}>
                      {fioriTabs
                      .filter((tab) =>
                        pathname === '/profile'
                          ? true
                          : pathname?.startsWith('/admin')
                            ? tab.href === '/launcher' || user?.role === 'ADMIN'
                            : pathname?.startsWith('/launcher/yubiq')
                              ? true
                              : tab.href !== '/launcher/activations/configuration' || !!user
                      )
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
                </div>
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
              <Link
                href={adminNavItem.href}
                className={pathname === adminNavItem.href || pathname?.startsWith(adminNavItem.href + '/') ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink}
              >
                <Icon name={adminNavItem.icon} size={20} className={styles.navIcon} />
                {adminNavItem.label}
              </Link>
              {user?.role === 'ADMIN' && (
                <Link
                  href={adminUsersNavItem.href}
                  className={pathname === adminUsersNavItem.href || pathname?.startsWith(adminUsersNavItem.href + '/') ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink}
                >
                  <Icon name={adminUsersNavItem.icon} size={20} className={styles.navIcon} />
                  {adminUsersNavItem.label}
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
