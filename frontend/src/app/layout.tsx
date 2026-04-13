import type { Metadata } from 'next';
import '@/styles/global.css';

export const metadata: Metadata = {
  title: 'Avvale Companion App',
  description:
    'Punto de acceso unificado a aplicaciones internas Avvale: activaciones por correo, pipeline de ventas, Yubiq Approve & Seal Filler y análisis de RFQs con IA.',
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
