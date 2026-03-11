#!/usr/bin/env sh
# Aplica migraciones Prisma. Requiere DATABASE_URL en el entorno.
# Ejemplo: DATABASE_URL="mysql://user:pass@host:3306/db" ./scripts/run-migrate.sh
set -e
cd "$(dirname "$0")/.."
npx prisma migrate deploy
