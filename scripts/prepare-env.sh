#!/usr/bin/env sh
# Paso 0 — Prepara los .env para backend y frontend a partir del .env de la raíz.
# Uso: 1) cp .env.example .env  2) Edita .env con tus valores  3) ./scripts/prepare-env.sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ ! -f "$ROOT/.env" ]; then
  echo "No existe .env en la raíz. Ejecuta: cp .env.example .env"
  echo "Luego edita .env con tus valores (DATABASE_URL, JWT_SECRET, etc.) y vuelve a ejecutar este script."
  exit 1
fi
cp "$ROOT/.env" "$ROOT/backend/.env"
cp "$ROOT/.env" "$ROOT/frontend/.env"
echo "Listo: .env copiado a backend/.env y frontend/.env"
