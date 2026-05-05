'use client';

import type { FC, ReactNode } from 'react';
import type { KycBlockIconKey } from './kycConstants';

type SvgProps = { className?: string };

const stroke = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function Svg({ className, children }: SvgProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      width={18}
      height={18}
      viewBox="0 0 24 24"
      aria-hidden
      {...stroke}
    >
      {children}
    </svg>
  );
}

/** Ficha de empresa */
export function KycIconBuilding(props: SvgProps) {
  return (
    <Svg {...props}>
      <path d="M6 22V10l6-3 6 3v12" />
      <path d="M10 22v-6h4v6" />
      <path d="M6 12h12" />
    </Svg>
  );
}

/** Resumen ejecutivo */
export function KycIconDocument(props: SvgProps) {
  return (
    <Svg {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8M8 17h6M8 9h4" />
    </Svg>
  );
}

/** Competencia / partners */
export function KycIconTarget(props: SvgProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </Svg>
  );
}

/** Economía */
export function KycIconMoney(props: SvgProps) {
  return (
    <Svg {...props}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 10v4" />
    </Svg>
  );
}

/** Modelo de negocio */
export function KycIconCompass(props: SvgProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36z" />
    </Svg>
  );
}

/** Clientes */
export function KycIconPeople(props: SvgProps) {
  return (
    <Svg {...props}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  );
}

/** Stack tecnológico */
export function KycIconChip(props: SvgProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
      <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
    </Svg>
  );
}

/** Procesos críticos */
export function KycIconWorkflow(props: SvgProps) {
  return (
    <Svg {...props}>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </Svg>
  );
}

/** Contexto sector */
export function KycIconGlobe(props: SvgProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </Svg>
  );
}

const BLOCK_ICONS: Record<KycBlockIconKey, FC<SvgProps>> = {
  money: KycIconMoney,
  compass: KycIconCompass,
  people: KycIconPeople,
  chip: KycIconChip,
  workflow: KycIconWorkflow,
  globe: KycIconGlobe,
};

export function KycBlockIcon({ name, className }: { name: KycBlockIconKey; className?: string }) {
  const Render = BLOCK_ICONS[name];
  return <Render className={className} />;
}
