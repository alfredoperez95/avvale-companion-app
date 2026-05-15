'use client';

import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useSearchParams } from 'next/navigation';

const KycUrlParamsContext = createContext<URLSearchParams>(new URLSearchParams());

function readClientSearchParams(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

/** Lee query de la URL sin suspender el árbol (a diferencia de `useSearchParams` en el layout). */
export function useKycSearchParams(): URLSearchParams {
  return useContext(KycUrlParamsContext);
}

function KycUrlParamsSync({ onParams }: { onParams: (params: URLSearchParams) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    onParams(new URLSearchParams(searchParams.toString()));
  }, [searchParams, onParams]);
  return null;
}

/**
 * Mantiene la query en contexto. Solo el sincronizador va en Suspense para no desmontar
 * el workspace (lista + detalle) al hacer `router.replace` entre empresas o pestañas.
 */
export function KycUrlParamsRoot({ children }: { children: ReactNode }) {
  const [params, setParams] = useState(readClientSearchParams);
  const onParams = useCallback((next: URLSearchParams) => {
    setParams(next);
  }, []);

  return (
    <KycUrlParamsContext.Provider value={params}>
      <Suspense fallback={null}>
        <KycUrlParamsSync onParams={onParams} />
      </Suspense>
      {children}
    </KycUrlParamsContext.Provider>
  );
}
