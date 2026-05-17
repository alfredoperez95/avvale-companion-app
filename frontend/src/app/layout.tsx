import type { Metadata, Viewport } from 'next';
import '@/styles/global.css';

export const metadata: Metadata = {
  title: 'Avvale Companion App',
  description:
    'Punto de acceso unificado a aplicaciones internas Avvale: activaciones por correo, pipeline de ventas, Yubiq Approve & Seal Filler y análisis de RFQs con IA.',
};

/** Sin zoom al enfocar inputs en iOS; teclado superpuesto sin reescalar el layout (Chrome 108+ / Safari 26+). */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: 'overlays-content',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
