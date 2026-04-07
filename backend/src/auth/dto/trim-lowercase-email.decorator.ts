import { Transform } from 'class-transformer';

/** Coherente con almacenamiento en BD (minúsculas, sin espacios extremos). */
export const trimLowercaseEmail = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value,
);
