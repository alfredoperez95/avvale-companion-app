'use client';

import { useLayoutEffect, type ReactNode } from 'react';

/**
 * Rutas públicas /login*: tema Microsoft (AVVALE ID®, tarjeta blanca, input compuesto).
 * Debe ejecutarse antes del pintado para que login.module.css aplique los selectores html[data-appearance='microsoft'].
 */
export default function LoginAppearance({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-appearance', 'microsoft');
  }, []);
  return <>{children}</>;
}
