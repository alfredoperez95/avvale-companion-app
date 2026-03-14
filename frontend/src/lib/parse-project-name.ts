/**
 * Áreas conocidas por defecto en el patrón "CLIENTE - AREA - PROYECTO".
 * Se usa cuando no se pasan áreas desde el backend. Comparación case-insensitive.
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
 * Parsea un nombre de proyecto: busca el primer segmento que sea un área conocida.
 * Todo lo anterior = cliente; todo lo posterior = nombre del proyecto.
 *
 * @param fullName - Texto completo (ej. "COFARES - centro... - SAIBORG - Proyecto...")
 * @param areaNames - Opcional: nombres de áreas desde el backend; si no se pasa, se usa HUBSPOT_AREAS
 */
export function parseHubSpotStyleProjectName(
  fullName: string,
  areaNames?: string[],
): { client: string; projectDescription: string } | null {
  if (!fullName || typeof fullName !== 'string') return null;
  const segments = fullName.split(' - ').map((s) => s.trim());
  const areas = areaNames?.length ? areaNames : HUBSPOT_AREAS;

  const areaIndex = segments.findIndex((seg) =>
    areas.some((area) => seg.toUpperCase() === area.toUpperCase()),
  );

  if (areaIndex < 0 || areaIndex === 0 || areaIndex === segments.length - 1) return null;

  const client = segments.slice(0, areaIndex).join(' - ').trim();
  const projectDescription = segments.slice(areaIndex + 1).join(' - ').trim();
  if (!client || !projectDescription) return null;

  return { client, projectDescription };
}
