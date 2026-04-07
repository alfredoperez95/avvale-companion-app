'use client';

import { useCallback, useEffect, useState } from 'react';
import '@ui5/webcomponents/dist/BusyIndicator.js';
import { apiFetch, redirectToLogin } from '@/lib/api';
import { AppShell } from '@/components/AppShell/AppShell';
import { LoadingScreen } from '@/components/LoadingScreen/LoadingScreen';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { UserProvider, type User } from '@/contexts/UserContext';
import { useSmoothLoading } from '@/hooks/useSmoothLoading';
import {
  clearAppearanceCookie,
  getAppearanceFromCookie,
  resolveAppearance,
  setAppearanceCookie,
} from '@/lib/appearance-cookie';
import '@/styles/fonts-fiori.css';
import '@/styles/icons-fiori.css';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const cookieAppearance = getAppearanceFromCookie();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'microsoft' | 'fiori'>(resolveAppearance(cookieAppearance ?? undefined));
  const showLoading = useSmoothLoading(loading, { delayMs: 150, minVisibleMs: 250 });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-appearance', theme);
  }, [theme]);

  useEffect(() => {
    const AUTH_MS = 20000;
    const ctrl = new AbortController();
    const timeoutId = window.setTimeout(() => ctrl.abort(), AUTH_MS);

    apiFetch('/api/auth/me', { signal: ctrl.signal })
      .then((r) => {
        if (r.status === 401) {
          redirectToLogin();
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((data) => {
        if (data == null || typeof data !== 'object' || !('id' in data)) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            clearAppearanceCookie();
            redirectToLogin();
          }
          return;
        }
        setUser(data);
        const nextTheme = resolveAppearance(data.appearance);
        setTheme(nextTheme);
        setAppearanceCookie(nextTheme);
        if (data?.id) {
          apiFetch('/api/user-config/bootstrap', { method: 'POST' }).catch(() => {});
        }
      })
      .catch(() => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          clearAppearanceCookie();
          redirectToLogin();
        }
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        setLoading(false);
      });
  }, []);

  const refreshUser = useCallback(async () => {
    const r = await apiFetch('/api/auth/me');
    if (r.status === 401) {
      redirectToLogin();
      return;
    }
    if (!r.ok) return;
    const data = (await r.json()) as User | null;
    if (data == null || typeof data !== 'object' || !('id' in data)) return;
    setUser(data);
    const nextTheme = resolveAppearance(data.appearance);
    setTheme(nextTheme);
    setAppearanceCookie(nextTheme);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined' || !user) return;
    const value = resolveAppearance(user.appearance);
    document.documentElement.setAttribute('data-appearance', value);
    setAppearanceCookie(value);
  }, [user]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ appearance?: string | null }>)?.detail;
      if (detail && 'appearance' in detail) {
        const nextTheme = resolveAppearance(detail.appearance);
        setTheme(nextTheme);
        setAppearanceCookie(nextTheme);
      }
    };
    window.addEventListener('theme-changed', handler);
    return () => window.removeEventListener('theme-changed', handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<typeof user>)?.detail;
      if (detail && typeof detail === 'object' && 'id' in detail) {
        setUser(detail);
      }
    };
    window.addEventListener('user-updated', handler);
    return () => window.removeEventListener('user-updated', handler);
  }, []);

  if (showLoading) {
    return (
      <AppShell user={user} theme={theme}>
        <LoadingScreen message="Preparando tu espacio de trabajo..." fullPage={false} />
      </AppShell>
    );
  }

  if (loading || !user) return null;

  const activeTheme = theme;
  return (
    <ThemeProvider theme={activeTheme}>
      <UserProvider user={user} refreshUser={refreshUser}>
        <AppShell user={user} theme={activeTheme}>
          {children}
        </AppShell>
      </UserProvider>
    </ThemeProvider>
  );
}
