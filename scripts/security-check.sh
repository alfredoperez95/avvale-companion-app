#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_TRIVY=0

usage() {
  cat <<'USAGE'
Uso:
  ./scripts/security-check.sh [--trivy]

Validación local de seguridad/desarrollo:
  1. Prisma validate + generate
  2. npm audit backend/frontend
  3. Unit tests backend/frontend
  4. Build backend/frontend

Opcional:
  --trivy   Construye imágenes Docker backend/frontend y las escanea con Trivy.

Requisitos:
  - Node.js 20+ / npm 10+
  - Docker + Trivy solo si usas --trivy
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --trivy)
      RUN_TRIVY=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Argumento no reconocido: $1" >&2
      usage
      exit 2
      ;;
  esac
done

step() {
  printf '\n==> %s\n' "$1"
}

run_in() {
  local dir="$1"
  shift
  (cd "$ROOT_DIR/$dir" && "$@")
}

step "Prisma validate"
run_in backend npx prisma validate

step "Prisma generate"
run_in backend npx prisma generate

step "npm audit backend"
run_in backend npm audit

step "npm audit frontend"
run_in frontend npm audit

if [[ "$RUN_TRIVY" -eq 1 ]]; then
  command -v docker >/dev/null 2>&1 || {
    echo "Docker no está instalado o no está en PATH." >&2
    exit 1
  }
  command -v trivy >/dev/null 2>&1 || {
    echo "Trivy no está instalado o no está en PATH." >&2
    exit 1
  }

  step "Docker build backend"
  docker build -t avvale-backend:security-check "$ROOT_DIR/backend"

  step "Trivy image backend"
  trivy image --exit-code 1 --severity HIGH,CRITICAL --vuln-type os,library avvale-backend:security-check

  step "Docker build frontend"
  docker build \
    --build-arg INTERNAL_API_URL=http://backend:4000 \
    -t avvale-frontend:security-check \
    "$ROOT_DIR/frontend"

  step "Trivy image frontend"
  trivy image --exit-code 1 --severity HIGH,CRITICAL --vuln-type os,library avvale-frontend:security-check
else
  step "Trivy image"
  echo "Omitido. Ejecuta ./scripts/security-check.sh --trivy para escanear imágenes Docker localmente."
fi

step "Unit tests backend"
run_in backend npm test

step "Unit tests frontend"
run_in frontend npm test

step "Build backend"
run_in backend npm run build

step "Build frontend"
run_in frontend env INTERNAL_API_URL=http://backend:4000 npm run build

printf '\nValidación local completada correctamente.\n'
