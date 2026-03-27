import type { SVGProps } from 'react';
import { phoneCountryFlagByIso } from './phoneCountryFlags';

function Placeholder(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 3 2" {...props}>
      <rect width="3" height="2" rx="0.06" fill="#e4e9ec" />
    </svg>
  );
}

type CountryFlagProps = {
  iso: string;
  className?: string;
};

export function CountryFlag({ iso, className }: CountryFlagProps) {
  const code = iso.trim().toUpperCase();
  const Flag = phoneCountryFlagByIso[code];
  if (!Flag) {
    return <Placeholder className={className} aria-hidden />;
  }
  return <Flag className={className} aria-hidden />;
}
