'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

type MainContentMotionProps = {
  children: ReactNode;
  className?: string;
};

/** Reinicia una entrada suave al cambiar de ruta dentro del shell autenticado. */
export function MainContentMotion({ children, className }: MainContentMotionProps) {
  const pathname = usePathname();
  const skipRouteMotion = pathname === '/launcher';
  const merged = [skipRouteMotion ? null : 'app-page-motion', className].filter(Boolean).join(' ');

  return (
    <div key={pathname} className={merged || undefined}>
      {children}
    </div>
  );
}
