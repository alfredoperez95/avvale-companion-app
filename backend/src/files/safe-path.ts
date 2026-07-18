import { BadRequestException } from '@nestjs/common';
import * as path from 'path';

export function resolvePathWithinBase(baseDir: string, relativePath: string): string {
  if (!relativePath || path.isAbsolute(relativePath)) {
    throw new BadRequestException('Ruta de archivo no permitida');
  }

  const base = path.resolve(baseDir);
  const full = path.resolve(base, relativePath);
  if (full !== base && !full.startsWith(`${base}${path.sep}`)) {
    throw new BadRequestException('Ruta de archivo fuera del directorio permitido');
  }

  return full;
}
