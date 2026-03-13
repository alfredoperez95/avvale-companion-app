/**
 * Áreas conocidas en el patrón HubSpot "CLIENTE - AREA - DESCRIPCIÓN".
 * Comparación case-insensitive.
 */
const HUBSPOT_AREAS = [
  'WISE',
  'SAIBORG',
  'PULSE RUN',
  'RUN',
  'PULSE GROW',
  'GROW',
  'YUBIQ',
];

/**
 * Parsea un nombre de proyecto en formato HubSpot "CLIENTE - AREA - DESCRIPCIÓN".
 * Si la segunda parte coincide con un área conocida (case-insensitive), devuelve
 * cliente y solo la descripción del proyecto; si no, devuelve null.
 */
export function parseHubSpotStyleProjectName(
  fullName: string
): { client: string; projectDescription: string } | null {
  if (!fullName || typeof fullName !== 'string') return null;
  const segments = fullName.split(' - ');
  if (segments.length < 3) return null;
  const areaSegment = segments[1].trim();
  const areaMatch = HUBSPOT_AREAS.some(
    (area) => areaSegment.toUpperCase() === area.toUpperCase()
  );
  if (!areaMatch) return null;
  return {
    client: segments[0].trim(),
    projectDescription: segments.slice(2).join(' - ').trim(),
  };
}
