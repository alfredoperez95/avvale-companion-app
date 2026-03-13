'use client';

import { useTheme } from '@/contexts/ThemeContext';
import styles from './Icon.module.css';

/** Nombres semánticos de iconos: usados en KPI, nav, etc. */
export type IconName =
  | 'total'
  | 'draft'
  | 'sent'
  | 'error'
  | 'home'
  | 'activations'
  | 'new'
  | 'settings';

interface IconProps {
  name: IconName;
  className?: string;
  /** Tamaño en px; por defecto 24 (Fiori) / 20 (Fluent) */
  size?: number;
  'aria-hidden'?: boolean;
}

/** Mapeo nombre semántico → clase SAP (Fiori). Ver icons-fiori.css */
const FIORI_ICON_CLASS: Record<IconName, string> = {
  total: 'sap-icon--activities',
  draft: 'sap-icon--write-2',      /* Borrador: lápiz/editar */
  sent: 'sap-icon--accept',       /* Enviadas: tick */
  error: 'sap-icon--message-error',
  home: 'sap-icon--home',
  activations: 'sap-icon--document-text',
  new: 'sap-icon--add-document',
  settings: 'sap-icon--action-settings',
};

/** Iconos Fluent (Microsoft) como SVG inline – sin dependencia de @fluentui/react-icons */
function FluentIconSvg({ name, size }: { name: IconName; size: number }) {
  const viewBox = '0 0 20 20';
  const path = FLUENT_SVG_PATH[name];
  if (!path) return null;
  return (
    <svg width={size} height={size} viewBox={viewBox} fill="currentColor" aria-hidden>
      <path d={path} fill="currentColor" />
    </svg>
  );
}

/* Tick/check para Enviadas (viewBox 0 0 20 20) */
const TICK_PATH = 'M14.35 4.65a.5.5 0 0 1 .7 0l-6 6-2.5-2.5a.5.5 0 0 1 .7-.7l1.8 1.8 5.65-5.65a.5.5 0 0 1 0 .7Z';

const FLUENT_SVG_PATH: Record<IconName, string> = {
  total: 'M10 3a7 7 0 0 1 7 7 7 7 0 0 1-7 7 7 7 0 0 1-7-7 7 7 0 0 1 7-7Zm0 1a6 6 0 0 0-6 6 6 6 0 0 0 6 6 6 6 0 0 0 6-6 6 6 0 0 0-6-6Zm.5 2v3h3v1h-3v3h-1v-3h-3V9h3V6h1Z',
  draft: 'M5.5 3A2.5 2.5 0 0 0 3 5.5v9A2.5 2.5 0 0 0 5.5 17h9a2.5 2.5 0 0 0 2.5-2.5v-9A2.5 2.5 0 0 0 14.5 3h-9ZM4 5.5C4 4.67 4.67 4 5.5 4h9c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5h-9A1.5 1.5 0 0 1 4 14.5v-9ZM5.5 6h9v1h-9V6Zm0 3h9v1h-9V9Zm0 3h6v1h-6v-1Z',
  sent: TICK_PATH,
  error: 'M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm0 1a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm0 3.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6.5Zm0 8a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z',
  home: 'M10.71 2.29a1 1 0 0 0-1.42 0l-7 7A1 1 0 0 0 3 11h1v6a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-6h1a1 1 0 0 0 .71-1.71l-7-7ZM15 16v-6h-2v6H7v-6H5v6H4v-6.59l6-6 6 6V16Z',
  activations: 'M7 4a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7ZM5 7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7Zm2 1a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H7Z',
  new: 'M10 3a.5.5 0 0 1 .5.5v6h6a.5.5 0 0 1 0 1h-6v6a.5.5 0 0 1-1 0v-6h-6a.5.5 0 0 1 0-1h6v-6A.5.5 0 0 1 10 3Z',
  settings: 'M10 2a2 2 0 0 1 2 2 2 2 0 0 1-2 2 2 2 0 0 1-2-2 2 2 0 0 1 2-2Zm0 1a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm0 4a4.5 4.5 0 0 1 4.5 4.5.5.5 0 0 1-1 0 3.5 3.5 0 0 0-3.5-3.5.5.5 0 0 1 0-1ZM10 12a2 2 0 0 1 2 2 2 2 0 0 1-2 2 2 2 0 0 1-2-2 2 2 0 0 1 2-2Zm0 1a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z',
};

export function Icon({ name, className, size = 24, 'aria-hidden': ariaHidden = true }: IconProps) {
  const theme = useTheme();

  if (theme === 'fiori') {
    const fioriClass = FIORI_ICON_CLASS[name];
    return (
      <span
        className={`sap-icon ${fioriClass} ${styles.fioriIcon} ${className ?? ''}`.trim()}
        style={{ fontSize: size }}
        aria-hidden={ariaHidden}
      />
    );
  }

  return (
    <span className={className} aria-hidden={ariaHidden} style={{ display: 'inline-flex', width: size, height: size }}>
      <FluentIconSvg name={name} size={size} />
    </span>
  );
}
