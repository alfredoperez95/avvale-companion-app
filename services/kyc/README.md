# Workzone KYC — standalone Docker slice

> **Aviso (Avvale Companion):** el producto usa KYC **nativo** (Nest, Prisma, tablas `kyc_*` en el MySQL de Companion, launcher en React). No arranques este contenedor para usar KYC en Companion. Este directorio queda como **demo/archivo** del slice Node+Postgres original.

---

Versión aislada de la aplicación KYC del Workzone, empaquetada en Docker con frontend, backend y base de datos propia. Diseñada para compartirse y correrse en cualquier máquina con Docker.

## Qué incluye

- **Frontend** — Dashboard KYC + informe imprimible (`index.html` + `report.html`)
- **Backend** — Node 20 (sin dependencias exóticas, HTTP nativo + `pg` + `bcryptjs` + `jsonwebtoken`)
- **BBDD** — PostgreSQL 16 con esquema propio (arranca vacía)
- **Chat KYC** — vía Claude Code CLI (incluido en la imagen). Cada usuario pone su propia `ANTHROPIC_API_KEY` en Ajustes (se guarda en `localStorage` y se envía al backend como header por petición)

## Requisitos

- Docker + Docker Compose
- Una API key de Anthropic por usuario (para el chat)

## Setup

```bash
cp .env.example .env
# Edita .env y cambia al menos:
#   - DB_PASSWORD
#   - JWT_SECRET  (usa: openssl rand -base64 64)
#   - ADMIN_EMAIL / ADMIN_PASSWORD

docker compose up -d --build
```

La primera vez, Postgres crea el esquema desde `init.sql` y el backend siembra el usuario admin definido en `.env`.

Abre http://localhost:3388 → login con las credenciales del admin.

## Arquitectura

```
docker-kyc/
├── docker-compose.yml      # db (postgres:16-alpine) + app (node:20-alpine)
├── Dockerfile              # instala claude CLI globalmente
├── init.sql                # esquema KYC limpio
├── .env.example
├── server/
│   ├── server.js           # HTTP server + auth middleware + static + routing
│   ├── auth.js             # JWT login + change-password + admin seed
│   ├── db-pg.js
│   ├── routes-kyc.js       # endpoints /api/kyc/*
│   └── package.json
└── public/
    ├── login.html
    ├── index.html          # Dashboard KYC (con ⚙️ Ajustes para API key)
    ├── report.html
    └── shared.css
```

## Login

Login básico email + contraseña → JWT (guardado en `localStorage` del navegador).

- El usuario admin se siembra en el primer arranque usando `ADMIN_EMAIL` / `ADMIN_PASSWORD` de `.env`
- Contraseña se cambia desde ⚙️ **Ajustes** → **Cambiar contraseña**
- No hay registro abierto. Para añadir más usuarios, entra al contenedor y usa `auth.createUser(...)` o añade un endpoint admin. Lo dejo fuera del MVP.

Si tu aplicación principal tiene otro sistema de login (SSO, OAuth, header de gateway, etc.), el punto de integración es `server/auth.js` — sustituye `getUser(req)` para aceptar la credencial que uses.

## API Key de Anthropic

Cada usuario introduce su propia key en el botón **⚙️** de la UI. Se guarda en `localStorage` del navegador y viaja al backend en el header `X-Anthropic-Key` solo para las peticiones de chat. El backend la inyecta como variable de entorno `ANTHROPIC_API_KEY` en el proceso `claude` spawneado.

Nunca se persiste en la BBDD.

## Claude CLI (chat KYC)

La imagen instala `@anthropic-ai/claude-code` globalmente. El binario se lanza con `--dangerously-skip-permissions` (no se ve shell interactiva) y las herramientas habilitadas son: `WebSearch WebFetch Read Write Edit Bash Grep Glob`. Cada sesión de chat trabaja en un directorio aislado bajo el volumen `kyc_sessions`.

## Endpoints

- `POST /api/auth/login` — email + password → JWT
- `GET  /api/auth/me`
- `POST /api/auth/change-password`
- `GET/POST/DELETE /api/kyc/companies...`
- `GET/PATCH /api/kyc/companies/:id/profile`
- `GET/POST/DELETE /api/kyc/org/...`
- `GET/POST /api/kyc/companies/:id/signals`
- `GET/POST/PATCH /api/kyc/companies/:id/open-questions`
- `GET/POST /api/kyc/companies/:id/chat/sessions`
- `POST /api/kyc/chat/sessions/:id/stream` (SSE, requiere `X-Anthropic-Key`)

Todos los `/api/kyc/*` requieren `Authorization: Bearer <jwt>`.

## Datos de prueba

La BBDD arranca vacía. Para probar:

1. Login como admin
2. **+ Añadir** → introduce un nombre de empresa
3. Se crea la empresa y se activa KYC con perfil vacío
4. Abre la empresa, pulsa **💬 Chat KYC** → **Nueva** (tipo "Intake") y empieza a dialogar

## Build & deploy

```bash
# Rebuild tras cambios
docker compose up -d --build

# Ver logs
docker compose logs -f app

# Reset completo (borra BBDD)
docker compose down -v
```

## Qué se ha recortado respecto al Workzone original

- Sin tiles/sidebar compartida
- Sin mirroring a `news_clients` (no existe esa tabla)
- Sin `/enrich` (scraping Google News / Trustpilot) — devuelve 501
- Sin `/api/news/*` ni `/api/meddpicc/*`
- Sin reset-password por email (solo change-password autenticado)
- Sin `is_external`, `password_reset_tokens`, `invitations`

Para reactivar cualquiera de esas piezas, los módulos originales viven en `projects/workzone/api/`.
