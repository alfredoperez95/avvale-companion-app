/**
 * Iconos lineales por dimensión MEDDPICC (sin emojis), estilo sobrio tipo Fluent/outline.
 */

import type { ReactNode } from 'react';

type Props = {
  dimensionKey: string;
  /** px */
  size?: number;
  className?: string;
};

type FrameProps = {
  size?: number;
  className?: string;
  children: ReactNode;
};

const VB = '0 0 24 24';

function SvgFrame({ size, className, children }: FrameProps) {
  return (
    <svg
      width={size ?? 20}
      height={size ?? 20}
      viewBox={VB}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

const s = {
  stroke: 'currentColor' as const,
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function MeddpiccDimensionIcon({ dimensionKey, size, className }: Props) {
  switch (dimensionKey) {
    case 'M':
      return (
        <SvgFrame size={size} className={className}>
          <path d="M4 18V10M10 18V5M16 18v-5M22 18v-9" {...s} />
        </SvgFrame>
      );
    case 'E':
      return (
        <SvgFrame size={size} className={className}>
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" {...s} />
          <rect x="3" y="7" width="18" height="12" rx="1.5" {...s} />
          <path d="M12 11v3M10.5 12.5h3" {...s} />
        </SvgFrame>
      );
    case 'D1':
      return (
        <SvgFrame size={size} className={className}>
          <path d="M9 3h6" {...s} />
          <path d="M8 5H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" {...s} />
          <path d="M9 10h6M9 14h4M9 18h2" {...s} />
        </SvgFrame>
      );
    case 'D2':
      return (
        <SvgFrame size={size} className={className}>
          <circle cx="6" cy="12" r="2.25" {...s} />
          <circle cx="12" cy="12" r="2.25" {...s} />
          <circle cx="18" cy="12" r="2.25" {...s} />
          <path d="M8.25 12h3.5M14.25 12h3.5" {...s} />
        </SvgFrame>
      );
    case 'P':
      return (
        <SvgFrame size={size} className={className}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" {...s} />
          <path d="M14 2v6h6" {...s} />
          <path d="M8 13h8M8 17h6" {...s} />
        </SvgFrame>
      );
    case 'I':
      return (
        <SvgFrame size={size} className={className}>
          <path d="M12 4l8 14H4l8-14z" {...s} />
          <path d="M12 9v4M12 17h.01" {...s} />
        </SvgFrame>
      );
    case 'C1':
      return (
        <SvgFrame size={size} className={className}>
          <path
            d="M12 3l7 4v5c0 4.5-3.2 7.8-7 9.5-3.8-1.7-7-5-7-9.5V7l7-4z"
            {...s}
          />
          <path d="M9 12l2 2 4-4" {...s} />
        </SvgFrame>
      );
    case 'C2':
      return (
        <SvgFrame size={size} className={className}>
          <path d="M8 12H4l2-2.5M4 12l2 2.5" {...s} />
          <path d="M16 12h4l-2-2.5M20 12l-2 2.5" {...s} />
          <path
            d="M10 12h4"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeDasharray="2 3"
          />
        </SvgFrame>
      );
    default:
      return (
        <SvgFrame size={size} className={className}>
          <circle cx="12" cy="12" r="8.5" {...s} />
        </SvgFrame>
      );
  }
}
