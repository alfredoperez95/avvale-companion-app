/** Alineado con `UserPosition` en Prisma / API. */
export const USER_POSITION_OPTIONS = [
  { value: 'GROWTH_MANAGING_DIRECTOR', label: 'Growth Managing Director' },
  { value: 'INDUSTRY_DIRECTOR', label: 'Industry Director' },
  { value: 'ACCOUNT_MANAGER', label: 'Account Manager' },
] as const;

export type UserPositionValue = (typeof USER_POSITION_OPTIONS)[number]['value'];

export function positionLabel(value: string | null | undefined): string {
  if (value == null || value === '') return '—';
  const found = USER_POSITION_OPTIONS.find((o) => o.value === value);
  return found?.label ?? value;
}

/** Puesto que solo puede tener una persona (regla en backend y desplegables). */
const EXCLUSIVE_SINGLE_USER_POSITION: UserPositionValue = 'GROWTH_MANAGING_DIRECTOR';

/**
 * Opciones de puesto para el perfil: oculta Growth Managing Director si ya lo tiene otra persona.
 * El usuario `currentUserId` sigue viendo la opción si él es quien lo tiene.
 */
export function getPositionOptionsForProfileEditor(
  currentUserId: string,
  growthManagingDirectorUserId: string | null | undefined,
): readonly (typeof USER_POSITION_OPTIONS)[number][] {
  return USER_POSITION_OPTIONS.filter((o) => {
    if (o.value !== EXCLUSIVE_SINGLE_USER_POSITION) return true;
    if (growthManagingDirectorUserId == null || growthManagingDirectorUserId === '') return true;
    return growthManagingDirectorUserId === currentUserId;
  });
}

/**
 * Opciones de puesto en administración: `editingUserId` es el usuario del modal o null al crear.
 */
export function getPositionOptionsForAdminEditor(
  users: { id: string; position?: string | null }[],
  editingUserId: string | null,
): readonly (typeof USER_POSITION_OPTIONS)[number][] {
  const holder = users.find((u) => u.position === EXCLUSIVE_SINGLE_USER_POSITION);
  return USER_POSITION_OPTIONS.filter((o) => {
    if (o.value !== EXCLUSIVE_SINGLE_USER_POSITION) return true;
    if (!holder) return true;
    return editingUserId != null && holder.id === editingUserId;
  });
}
