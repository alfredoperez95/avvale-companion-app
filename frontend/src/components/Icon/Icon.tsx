'use client';

import {
  ChartMultiple20Regular,
  Document20Regular,
  Mail20Regular,
  ErrorCircle20Regular,
  Home20Regular,
  DocumentMultiple20Regular,
  Add20Regular,
  Settings20Regular,
} from '@fluentui/react-icons';
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
  draft: 'sap-icon--document',
  sent: 'sap-icon--email',
  error: 'sap-icon--message-error',
  home: 'sap-icon--home',
  activations: 'sap-icon--document-text',
  new: 'sap-icon--add-document',
  settings: 'sap-icon--action-settings',
};

const FLUENT_ICONS: Record<IconName, React.ComponentType<{ style?: React.CSSProperties }>> = {
  total: ChartMultiple20Regular,
  draft: Document20Regular,
  sent: Mail20Regular,
  error: ErrorCircle20Regular,
  home: Home20Regular,
  activations: DocumentMultiple20Regular,
  new: Add20Regular,
  settings: Settings20Regular,
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

  const FluentIconComponent = FLUENT_ICONS[name];
  return (
    <span className={className} aria-hidden={ariaHidden} style={{ display: 'inline-flex', width: size, height: size }}>
      {FluentIconComponent && <FluentIconComponent style={{ width: size, height: size }} />}
    </span>
  );
}
