'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AppShell } from '@/components/AppShell/AppShell';
import { LoadingScreen } from '@/components/LoadingScreen/LoadingScreen';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { UserProvider } from '@/contexts/UserContext';
import { useSmoothLoading } from '@/hooks/useSmoothLoading';
import '@/styles/fonts-fiori.css';
import '@/styles/icons-fiori.css';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{
    id: string;
    email: string;
    name?: string | null;
    lastName?: string | null;
    position?: string | null;
    avatarPath?: string | null;
    appearance?: string | null;
    role?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'microsoft' | 'fiori'>('microsoft');
  const showLoading = useSmoothLoading(loading, { delayMs: 150, minVisibleMs: 250 });

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then((r) => {
        if (r.status === 401) {
          window.location.href = '/login';
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((data) => {
        setUser(data);
        if (data?.appearance != null) setTheme(data.appearance === 'fiori' ? 'fiori' : 'microsoft');
      })
      .catch(() => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined' || !user) return;
    const value = user.appearance === 'fiori' ? 'fiori' : 'microsoft';
    document.documentElement.setAttribute('data-appearance', value);
  }, [user]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ appearance?: string | null }>)?.detail;
      if (detail?.appearance != null) {
        setTheme(detail.appearance === 'fiori' ? 'fiori' : 'microsoft');
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
      <UserProvider user={user}>
        <AppShell user={user} theme={activeTheme}>
          {children}
        </AppShell>
      </UserProvider>
    </ThemeProvider>
  );
}
