'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

type MainContentMotionProps = {
  children: ReactNode;
  className?: string;
};

/** Clave estable para no desmontar layouts con estado (p. ej. KYC al cambiar de empresa). */
function mainContentMotionKey(pathname: string | null): string | null {
  if (pathname == null) return pathname;
  if (pathname.startsWith('/launcher/kyc')) return '/launcher/kyc';
  return pathname;
}

/** Reinicia una entrada suave al cambiar de ruta dentro del shell autenticado. */
export function MainContentMotion({ children, className }: MainContentMotionProps) {
  const pathname = usePathname();
  const motionKey = mainContentMotionKey(pathname);
  const skipRouteMotion =
    pathname === '/launcher' ||
    pathname?.startsWith('/launcher/activations/configuration') ||
    pathname?.startsWith('/launcher/activations/activate') ||
    pathname?.startsWith('/launcher/kyc');
  const merged = [skipRouteMotion ? null : 'app-page-motion', className].filter(Boolean).join(' ');

  return (
    <div key={motionKey ?? undefined} className={merged || undefined}>
      {children}
    </div>
  );
}
