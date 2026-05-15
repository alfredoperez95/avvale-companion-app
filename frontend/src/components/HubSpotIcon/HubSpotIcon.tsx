interface HubSpotIconProps {
  size?: number;
  className?: string;
}

/** Isotipo HubSpot (engranaje naranja #FF7A59). */
export function HubSpotIcon({ size = 18, className }: HubSpotIconProps) {
  return (
    <img
      className={className}
      src="/icons/hubspot-sprocket.png"
      width={size}
      height={size}
      alt=""
      aria-hidden
      decoding="async"
      draggable={false}
    />
  );
}
