# Plataforma de Activaciones

Aplicación web para gestionar activaciones por email, con backend NestJS, frontend Next.js y orquestación de envíos vía Make.

**En Mac:** Todos los comandos están pensados para Terminal (zsh o bash). Usa la misma terminal para todo el flujo.

---

## Requisitos en Mac

- **Node.js 22+**  
  Con Homebrew: `brew install node`  
  O con nvm: `nvm install 22 && nvm use 22`
- **npm** (viene con Node)
- **Docker Desktop** (opcional, para MariaDB o para levantar todo en contenedores): [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)

Funciona en Mac Intel y Apple Silicon (M1/M2/M3).

Comprueba en la terminal:
```bash
node -v   # v22.x o superior
npm -v
```

---

## Paso 0 — Preparar entorno

Hazlo una sola vez antes de arrancar backend, frontend o base de datos.

1. **Copia el ejemplo de variables y edítalo con tus valores:**
   ```bash
   cp .env.example .env
   open -e .env
   ```
   (En Mac, `open -e .env` abre `.env` en TextEdit. Si prefieres otro editor: `code .env`, `nano .env`, etc.)

   Rellena en `.env` al menos:
   - **DATABASE_URL**: `mysql://USER:PASSWORD@HOST:3306/DATABASE` (con tu MariaDB).
   - **JWT_SECRET**: una cadena secreta larga y aleatoria (en producción no uses `change-me-in-production`).
   - **NEXT_PUBLIC_API_URL**: en local suele ser `http://localhost:4000`; en producción, la URL pública del backend.

2. **Propaga `.env` a backend y frontend** (desde la raíz del repo):
   ```bash
   chmod +x scripts/prepare-env.sh
   ./scripts/prepare-env.sh
   ```
   Así `backend/` y `frontend/` tendrán su copia de `.env` y leerán las mismas variables. En Mac no hace falta `bash` delante: el shebang del script usa `sh`.

3. **Comprueba:** Debe existir `backend/.env` y `frontend/.env` (no los subas a Git).

Siguiente: **Paso 1 — MariaDB** (si aún no tienes la base de datos) o **Paso 2 — Backend** (si ya tienes MariaDB).

---

## Estructura del repositorio

- `backend/` — API NestJS (Prisma, MariaDB, JWT). Incluye `Dockerfile`.
- `frontend/` — Next.js (App Router). Incluye `Dockerfile`.
- `docs/VERIFICACION.md` — Comprobación paso a paso (health, auth, frontend).
- `docs/MAKE.md` — Webhook a Make, variables `MAKE_*` y callback opcional.
- `.env.example` — Variables de entorno de ejemplo

Cada servicio se construye y ejecuta con su propio Dockerfile (sin docker-compose).

## Requisitos (resumen)

- Node.js 22+ y npm (ver **Requisitos en Mac** arriba)
- Docker (opcional; para MariaDB en contenedor o despliegue)

## Desarrollo local (sin contenedores)

### 1. Variables de entorno

Ya hecho en **Paso 0** (`.env` en la raíz y `./scripts/prepare-env.sh`). Si no, hazlo ahora.

Para **envíos vía Make**, define al menos `MAKE_WEBHOOK_URL` (y opcionalmente `MAKE_WEBHOOK_SECRET`, `MAKE_CALLBACK_SECRET`). Detalle del payload JSON y del escenario en [docs/MAKE.md](docs/MAKE.md).

### 2. Base de datos y tablas

**Si ya tienes MariaDB en producción** (ej. Coolify/host con DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS):

1. Crea `backend/.env` con la URL de conexión (usa tus variables reales):
   ```env
   DATABASE_URL="mysql://DB_USER:DB_PASS@DB_HOST:DB_PORT/DB_NAME"
   ```
2. Desde la carpeta `backend`, aplica las migraciones para crear las tablas:
   ```bash
   cd backend
   npm install
   npx prisma migrate deploy
   ```
   En Mac, si prefieres no usar `backend/.env`, puedes pasar la URL en la misma línea:
   ```bash
   DATABASE_URL="mysql://user:pass@host:3306/db" npx prisma migrate deploy
   ```

**MariaDB local** (contenedor):

```bash
docker run -d --name mariadb \
  -e MARIADB_ROOT_PASSWORD=root \
  -e MARIADB_DATABASE=activation \
  -e MARIADB_USER=app \
  -e MARIADB_PASSWORD=app \
  -p 3306:3306 \
  mariadb:11
```

Define `DATABASE_URL` en `.env` (o en `backend/.env`), por ejemplo:
`DATABASE_URL="mysql://app:app@localhost:3306/activation"`

### 3. Backend

```bash
cd backend
npm install
npx prisma migrate deploy
npx prisma generate   # regenera el cliente si cambias el schema (evita errores de tipos TS)
npm run start:dev
```

API en `http://localhost:4000` (prefijo `/api`). Si tras modificar `prisma/schema.prisma` el backend no compila (p. ej. "property X does not exist"), ejecuta `npx prisma generate` en `backend/`.

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend en `http://localhost:3000`. Ajusta `NEXT_PUBLIC_API_URL` si la API no está en `http://localhost:4000`.

### 5. Primer usuario

En la terminal (Mac viene con `curl`):
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"tu@email.com","password":"minimo6","name":"Tu Nombre"}'
```

## Ejecución con Docker (solo Dockerfiles)

Cada servicio se construye y ejecuta por separado.

### 1. MariaDB

```bash
docker run -d --name mariadb \
  -e MARIADB_ROOT_PASSWORD=root \
  -e MARIADB_DATABASE=activation \
  -e MARIADB_USER=app \
  -e MARIADB_PASSWORD=app \
  -p 3306:3306 \
  mariadb:11
```

Espera unos segundos a que la base esté lista.

### 2. Backend

```bash
cd backend
docker build -t activation-backend .
docker run -d --name backend --link mariadb:mariadb \
  -e DATABASE_URL="mysql://app:app@mariadb:3306/activation" \
  -e JWT_SECRET=change-me-in-production \
  -p 4000:4000 \
  activation-backend
```

### 3. Frontend

```bash
cd frontend
docker build -t activation-frontend .
docker run -d --name frontend \
  -e NEXT_PUBLIC_API_URL=http://localhost:4000 \
  -p 3000:3000 \
  activation-frontend
```

Desde el navegador, la API debe ser accesible en la URL que uses (por ejemplo `http://localhost:4000`). Si el frontend corre en otro host, ajusta `NEXT_PUBLIC_API_URL` en el build:  
`docker build --build-arg NEXT_PUBLIC_API_URL=https://api.ejemplo.com -t activation-frontend .`

## Despliegue en Coolify

En Coolify puedes desplegar cada servicio por separado usando:

- **MariaDB**: imagen `mariadb:11` y variables de entorno como arriba.
- **Backend**: build desde `backend/Dockerfile`, variables `DATABASE_URL`, `JWT_SECRET`, etc.
- **Frontend**: build desde `frontend/Dockerfile`, variable `NEXT_PUBLIC_API_URL` apuntando a la URL pública del backend.

No es necesario docker-compose; cada Dockerfile es independiente.

## API (resumen)

- `POST /api/auth/register` — Registro
- `POST /api/auth/login` — Login (devuelve `accessToken`)
- `GET /api/auth/me` — Usuario actual (Bearer token)
- `GET /api/activations` — Lista de activaciones del usuario (Bearer token)
- `GET /api/activations/:id` — Detalle (solo si es del usuario)

Todos los datos de activaciones están filtrados por usuario autenticado en el backend.

---

## Resumen rápido (Mac)

Orden sugerido en una sola terminal (o una por servicio):

```bash
# Paso 0
cp .env.example .env && open -e .env
# (edita .env, guarda y cierra)
chmod +x scripts/prepare-env.sh && ./scripts/prepare-env.sh

# Paso 1 — Solo si usas MariaDB local en Docker
docker run -d --name mariadb -e MARIADB_ROOT_PASSWORD=root -e MARIADB_DATABASE=activation -e MARIADB_USER=app -e MARIADB_PASSWORD=app -p 3306:3306 mariadb:11

# Paso 2 — Backend (deja esta terminal abierta)
cd backend && npm install && npx prisma migrate deploy && npm run start:dev

# En otra terminal: Paso 3 — Frontend
cd frontend && npm install && npm run dev

# En otra terminal: Paso 4 — Primer usuario
curl -X POST http://localhost:4000/api/auth/register -H "Content-Type: application/json" -d '{"email":"tu@email.com","password":"minimo6","name":"Tu Nombre"}'
```

Luego abre en el navegador: `http://localhost:3000`
