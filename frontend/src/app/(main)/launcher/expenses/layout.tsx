import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Gastos Avvale',
  applicationName: 'Gastos Avvale',
  manifest: '/expenses-manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Gastos Avvale',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [{ url: '/icon.png', sizes: 'any', type: 'image/png' }],
    apple: [{ url: '/icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export default function ExpensesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
