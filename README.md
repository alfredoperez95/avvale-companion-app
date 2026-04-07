# Avvale Companion App — Plataforma de Activaciones

Aplicación web para **gestionar activaciones por correo**: borradores, destinatarios, áreas, plantillas, adjuntos, firma global y **envío orquestado vía Make.com** (webhook + callback). Incluye **App Launcher** (varias apps en un mismo front), tema **Microsoft-like** o **SAP Fiori-like**, y zona de **perfil / cuenta**.

**Stack:** monorepo con **NestJS 10** (API REST; rutas en el servidor **sin** prefijo `/api`, p. ej. `/auth/login`), **Prisma 6** + **MySQL/MariaDB**, **Next.js 15** (App Router, React 19), cola **BullMQ** sobre **Redis**, integración **Make** (HTTP webhook + callback opcional). El front usa **`/api/...`** en mismo origen (rewrite de Next) o **`resolveApiUrl()`** cuando `NEXT_PUBLIC_API_URL` apunta al backend.

---

## Contenido de este README

1. [Arquitectura y módulos](#arquitectura-y-módulos)
2. [Requisitos](#requisitos)
3. [Estructura del repositorio](#estructura-del-repositorio)
4. [Variables de entorno](#variables-de-entorno)
5. [Paso 0 — Preparar `.env`](#paso-0--preparar-env)
6. [Redis en desarrollo](#redis-en-desarrollo)
7. [Desarrollo local](#desarrollo-local)
8. [Docker (backend y frontend)](#docker-backend-y-frontend)
9. [Producción — comprobaciones rápidas](#producción--comprobaciones-rápidas)
10. [Flujo de envío y estados](#flujo-de-envío-y-estados)
11. [Scripts útiles](#scripts-útiles)
12. [Documentación adicional](#documentación-adicional)
13. [API — resumen](#api--resumen)

---

## Arquitectura y módulos

### Backend (`backend/`)

| Área | Descripción |
|------|-------------|
| **Auth** | JWT (`POST /auth/register`, `login`, `GET/PATCH /auth/me`), avatar (`POST/DELETE …/me/avatar`), apariencia usuario. |
| **Activaciones** | CRUD filtrado por usuario; numeración `activation_number`; envío asíncrono `POST …/send` (cola). |
| **Cola BullMQ** | Worker procesa envío a Make; reintentos configurables (`ACTIVATION_SEND_QUEUE_*`). |
| **Make** | `MakeService.triggerWebhook` (POST saliente a `MAKE_WEBHOOK_URL`); `POST /webhooks/make/callback` para cierre `SENT` / `FAILED`. |
| **Áreas / subáreas** | Catálogo asociado a activaciones. |
| **Contactos / billing CC** | Contactos para copias en facturación. |
| **Plantillas email / firma** | Plantillas y firma HTML global (admin/configuración según rol). |
| **User config** | Bootstrap de preferencias. |
| **Users** | Gestión de usuarios (rutas protegidas **ADMIN**). |
| **Health** | `GET /health` — healthcheck Docker/Coolify. |

**Roles:** `USER` | `ADMIN`. El registro público crea usuarios `USER`; el rol **ADMIN** se asigna en base de datos (u operaciones internas), según vuestra política.

### Frontend (`frontend/`)

| Ruta / concepto | Descripción |
|-----------------|-------------|
| **`/login`** | Autenticación; token en `localStorage`. |
| **`/launcher`** | App Launcher (acceso a Activaciones y enlaces externos). |
| **`/launcher/activations/*`** | Dashboard, listado, nueva activación, edición, detalle, configuración (Fiori: pestañas superiores). |
| **`/admin`** | Gestión de usuarios (solo **ADMIN**). |
| **`/profile`** | Mi cuenta: datos, foto, apariencia Microsoft/Fiori. |

**Temas:** `AppShell` con navegación lateral (Microsoft) o cabecera + pestañas (Fiori). El front puede reescribir `/api/*` hacia el backend vía `next.config.ts` (`rewrites`) o llamar directamente a `NEXT_PUBLIC_API_URL`.

**UI:** TipTap (editor rico), UI5 Web Components, Fluent icons, Tablas con columnas configurables, integración Make documentada en payloads JSON.

### Datos

- **MySQL/MariaDB** vía Prisma; migraciones en `backend/prisma/migrations/`.
- **Adjuntos** en disco (`ATTACHMENTS_DIR`); URLs públicas temporales para que Make descargue; revocación tras callback `SENT` (documentado en `docs/MAKE.md`).

---

## Requisitos

- **Node.js 22+** y **npm**
- **MySQL o MariaDB** accesible desde el backend
- **Redis** (necesario para encolar envíos a Make en tiempo real)
- **Docker** (opcional: MariaDB, Redis de desarrollo, imágenes de despliegue)

En Mac (Intel o Apple Silicon):

```bash
node -v   # v22.x o superior
npm -v
```

---

## Estructura del repositorio

```
├── backend/           # NestJS, Prisma, Dockerfile, docker-compose.dev.yml (solo Redis)
├── frontend/          # Next.js, Dockerfile (output standalone)
├── docs/              # MAKE, máquina de estados, verificación
├── scripts/           # prepare-env.sh (copia .env raíz → backend y frontend)
├── .env.example       # Plantilla principal de variables
└── README.md          # Este archivo
```

Los **Dockerfiles operativos** del producto Node están en **`backend/`** y **`frontend/`**. El archivo `Dockerfile` en la **raíz** del repo no forma parte del flujo estándar de esta app Nest/Next.

---

## Variables de entorno

Origen único: **`.env` en la raíz**; luego [`scripts/prepare-env.sh`](scripts/prepare-env.sh) copia a `backend/.env` y `frontend/.env`. No subas `.env` a Git.

| Variable | Uso |
|----------|-----|
| `DATABASE_URL` | MySQL/MariaDB (`mysql://USER:PASS@HOST:PORT/DB`) |
| `JWT_SECRET` | Firma JWT (obligatorio; valor fuerte en producción) |
| `JWT_EXPIRES_IN` | Tiempo máximo de sesión (JWT de acceso; ej. `12h`, `5d`, `7d`) |
| `CORS_ORIGIN` | Origen(es) exactos del front en el navegador (`https://…`), separados por coma. Si queda vacío, las peticiones con cabecera `Origin` fallan por CORS. |
| `NEXT_PUBLIC_API_URL` | URL pública del API para el navegador (build del front). Vacío en cliente puede implicar mismo origen + rewrites. |
| `INTERNAL_API_URL` | Solo **build** del frontend: URL que usa Next (servidor) para reescribir `/api/*` hacia Nest. En Docker/Coolify suele ser `http://nombre-servicio-backend:4000`; sin esto, el rewrite puede apuntar a `localhost:4000` y romper login/enlace mágico. |
| `BACKEND_PUBLIC_URL` | Recomendada si difiere: URL base del backend para payloads a Make (adjuntos, callback). Ver [docs/MAKE.md](docs/MAKE.md). |
| `REDIS_URL` o `REDIS_HOST`/`REDIS_PORT`/… | BullMQ |
| `BULL_PREFIX` | Prefijo Redis (default `avvale`) |
| `ACTIVATION_SEND_QUEUE_ATTEMPTS` | Reintentos del job de envío (default 5) |
| `ACTIVATION_SEND_QUEUE_BACKOFF_MS` | Backoff exponencial (default 5000) |
| `MAKE_WEBHOOK_URL` | URL del Custom Webhook de Make |
| `MAKE_WEBHOOK_TIMEOUT_MS` | Timeout del POST saliente al webhook (default 30000 ms) |
| `MAKE_WEBHOOK_SECRET` | Opcional: cabecera `X-Webhook-Secret` |
| `MAKE_CALLBACK_SECRET` | Secreto del cuerpo JSON del callback Make → `POST /api/webhooks/make/callback` |
| `MAKE_PENDING_CALLBACK_TIMEOUT_MS` | Watchdog: tiempo máximo en `PENDING_CALLBACK` antes de `FAILED` (también compat. `MAKE_READY_TO_SEND_TIMEOUT_MS`) |
| `ATTACHMENTS_DIR` | Directorio de ficheros subidos/descargados (en producción: volumen persistente) |
| `PORT` | Backend (default 4000) |
| `MAIL_FROM`, `SMTP_*`, `MAGIC_LINK_BASE_URL` | Login por **enlace mágico** (correo transaccional). Ver [docs/VERIFICACION.md](docs/VERIFICACION.md) sección 8. En local: `MAIL_SKIP_SEND=true`. |

Detalle de Make, payload **schema v4** y callback: **[docs/MAKE.md](docs/MAKE.md)**.  
También existe **`backend/.env.example`** con comentarios alineados al despliegue del backend.

---

## Paso 0 — Preparar `.env`

```bash
cp .env.example .env
# Edita .env (DATABASE_URL, JWT_SECRET, NEXT_PUBLIC_API_URL, REDIS_URL, MAKE_*, etc.)

chmod +x scripts/prepare-env.sh
./scripts/prepare-env.sh
```

Debe existir `backend/.env` y `frontend/.env`.

---

## Redis en desarrollo

La cola de envío **requiere Redis**. En local:

```bash
cd backend
npm run redis:dev    # docker compose -f docker-compose.dev.yml up -d
# npm run redis:dev:down  # para parar
```

Asegúrate de que `REDIS_URL` en `.env` apunte a ese Redis (por ejemplo `redis://127.0.0.1:6379/0`).

---

## Desarrollo local

### 1. Base de datos

Aplica migraciones desde `backend/`:

```bash
cd backend
npm install
npx prisma migrate deploy
npx prisma generate
```

### 2. Backend

```bash
npm run start:dev
```

Consola esperada: `Backend running at http://localhost:4000/api` y orígenes CORS.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Abre `http://localhost:3000` (o el puerto que indique Next).

### 4. Primer usuario

```bash
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"tu@email.com","password":"minimo6","name":"Tu Nombre"}'
```

### 5. Comprobación rápida

```bash
curl -s http://localhost:4000/health
# {"status":"ok","database":"connected"} o similar según controlador Health
```

Más pasos: **[docs/VERIFICACION.md](docs/VERIFICACION.md)**.

### MariaDB en Docker (ejemplo)

```bash
docker run -d --name mariadb \
  -e MARIADB_ROOT_PASSWORD=root \
  -e MARIADB_DATABASE=activation \
  -e MARIADB_USER=app \
  -e MARIADB_PASSWORD=app \
  -p 3306:3306 \
  mariadb:11
```

`DATABASE_URL="mysql://app:app@localhost:3306/activation"`

---

## Docker (backend y frontend)

El **entrypoint** del backend ejecuta **`npx prisma migrate deploy`** antes de arrancar ([`backend/scripts/entrypoint.sh`](backend/scripts/entrypoint.sh)).

### Backend

```bash
cd backend
docker build -t activation-backend .
docker run -d --name backend \
  -e DATABASE_URL="mysql://..." \
  -e JWT_SECRET="..." \
  -e REDIS_URL="redis://..." \
  -e CORS_ORIGIN="https://tu-front.example.com" \
  -p 4000:4000 \
  activation-backend
```

Inyecta también `MAKE_*`, `BACKEND_PUBLIC_URL` o `NEXT_PUBLIC_API_URL` según entorno.

### Frontend

`NEXT_PUBLIC_*` se resuelve en **build time**:

```bash
cd frontend
docker build --build-arg NEXT_PUBLIC_API_URL=https://api.example.com -t activation-frontend .
docker run -d -p 3000:3000 activation-frontend
```

Ajusta `next.config.ts` si usáis rewrites al mismo host.

### Coolify / PaaS

Patrón habitual: servicio MariaDB, servicio **Redis**, build del **backend** desde `backend/Dockerfile`, build del **frontend** desde `frontend/Dockerfile` con la URL pública correcta del API.

**Login en PRO:** si el reverse proxy solo enruta **`/api/*`** hacia Nest (mismo dominio que el front), define **`NEXT_PUBLIC_API_STRIP_PREFIX=false`** en el build del frontend (y el `NEXT_PUBLIC_API_URL` del dominio público). Si el API es un host tipo `https://api.tu-dominio.com` con Nest en la raíz, deja el valor por defecto (strip `true`) o no definas la variable.

Si el despliegue falla con **`P3009`** o migración fallida `20260402090000_user_anthropic_credentials`, sigue **[docs/PRISMA_P3009_COOLIFY.md](docs/PRISMA_P3009_COOLIFY.md)** (resolver estado en MySQL y `prisma migrate resolve`).

---

## Producción — comprobaciones rápidas

1. **`CORS_ORIGIN`**: debe listar el/los orígenes reales del front (p. ej. `https://www.avvalecompanion.app` y el apex si aplica), no solo localhost.
2. **`JWT_SECRET`**: largo y aleatorio.
3. **Redis** estable y alcanzable desde el backend (sin Redis no hay envíos por cola fiables).
4. **URLs públicas HTTPS**: `NEXT_PUBLIC_API_URL` / `BACKEND_PUBLIC_URL` y callback Make (`https://www.avvalecompanion.app/api/webhooks/make/callback` o el host que uséis).
5. **Volumen persistente** para `ATTACHMENTS_DIR` si usáis adjuntos.
6. **`docker build`** del frontend con el `NEXT_PUBLIC_API_URL` definitivo (o mismo origen + proxy).

Lista detallada (variables, Make, DNS): **[docs/VERIFICACION.md](docs/VERIFICACION.md)** (sección 7).

El tráfico **entrante** en tu dominio (p. ej. ngrok) muestra callbacks; los fallos de **“Reintentando”** suelen ser del **POST saliente** a `MAKE_WEBHOOK_URL` (no aparecen en el túnel de callbacks). Aumentar `MAKE_WEBHOOK_TIMEOUT_MS` si Make tarda en responder 200.

---

## Flujo de envío y estados

1. Usuario: **`POST /api/activations/:id/send`** → adjuntos publicados, estado **`QUEUED`**, job en Redis.
2. Worker: **`PROCESSING`** → POST a Make → si OK, **`PENDING_CALLBACK`** (con protección de carrera frente al callback rápido).
3. Make ejecuta el escenario y puede llamar **`POST /api/webhooks/make/callback`** → **`SENT`** o **`FAILED`**.
4. Watchdog opcional si el callback no llega a tiempo.

Tabla completa de estados y transiciones: **[docs/ACTIVATION_STATE_MACHINE.md](docs/ACTIVATION_STATE_MACHINE.md)**.

---

## Scripts útiles

| Dónde | Comando | Descripción |
|-------|---------|-------------|
| Raíz | `./scripts/prepare-env.sh` | Propaga `.env` a backend y frontend |
| `backend` | `npm run redis:dev` / `redis:dev:down` | Redis local (Docker) |
| `backend` | `npm run reset:activations` | Borra todas las activaciones y reinicia `AUTO_INCREMENT` de numeración (ver script; MySQL) |
| `backend` | `npm run import:cc-contacts` | Importación de contactos CC (script existente) |
| `backend` | `npx prisma migrate deploy` | Migraciones (también en entrypoint Docker) |
| `backend` | `npx prisma studio` | UI de datos |

---

## Documentación adicional

| Archivo | Contenido |
|---------|-----------|
| [docs/MAKE.md](docs/MAKE.md) | Webhook Make, variables, payload v4, callback, adjuntos públicos |
| [docs/ACTIVATION_STATE_MACHINE.md](docs/ACTIVATION_STATE_MACHINE.md) | Estados, BullMQ, orquestador, watchdog |
| [docs/VERIFICACION.md](docs/VERIFICACION.md) | Health, auth, comprobaciones locales y checklist producción (dominio HTTPS) |
| [docs/PRISMA_P3009_COOLIFY.md](docs/PRISMA_P3009_COOLIFY.md) | Error Prisma P3009 / migración fallida en producción (Coolify) |

---

## API — resumen

Rutas tal como las expone **Nest** (sin `/api`). El front llama **`/api/...`** en el mismo dominio o **`resolveApiUrl('/api/…')`** con `NEXT_PUBLIC_API_URL`.

| Método | Ruta (Nest) | Notas |
|--------|-------------|-------|
| GET | `/health` | Probes Docker/Coolify |
| POST | `/auth/register` | Alta usuario |
| POST | `/auth/login` | Token JWT |
| POST | `/auth/magic-link/request` | Solicitar enlace mágico (correo; respuesta genérica) |
| POST | `/auth/magic-link/verify` | Canjear token del enlace → mismo JWT que login |
| GET | `/auth/me` | Perfil (Bearer) |
| PATCH | `/auth/me` | Actualizar perfil / apariencia |
| POST/DELETE | `/auth/me/avatar` | Foto de perfil |
| — | `/activations` | Lista, creación, detalle, edición (borrador), envío, adjuntos… (Bearer, filtrado por usuario) |
| POST | `/webhooks/make/callback` | Cuerpo JSON con `secret` alineado a `MAKE_CALLBACK_SECRET` |

Las **activaciones** visibles por API están **acotadas al usuario autenticado** salvo rutas de administración explícitas.

---

## Resumen de arranque local (una referencia)

```bash
cp .env.example .env && ./scripts/prepare-env.sh   # tras editar .env
cd backend && npm run redis:dev    # Redis
cd backend && npm install && npx prisma migrate deploy && npm run start:dev
# otra terminal:
cd frontend && npm install && npm run dev
```

Luego: `http://localhost:3000` y registro con `curl` o flujo de login.

---

*Proyecto: **Companion App** — aplicación de **Activaciones** dentro del ecosistema Avvale.*
