import type { ReactNode } from 'react';
import LoginAppearance from './LoginAppearance';

const AVVALE_LOGO_PRELOAD =
  'https://www.sap.com/dam/application/shared/logos/customer/a-g/avvale-customer-logo.png';

export default function LoginRouteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <link rel="preload" as="image" href={AVVALE_LOGO_PRELOAD} />
      <LoginAppearance>{children}</LoginAppearance>
    </>
  );
}
