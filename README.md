# Plataforma de Activaciones

Aplicación web para gestionar activaciones por email, con backend NestJS, frontend Next.js y orquestación de envíos vía Make.

## Estructura del repositorio

- `backend/` — API NestJS (Prisma, MariaDB, JWT)
- `frontend/` — Next.js (App Router)
- `docker-compose.yml` — Orquestación local (MariaDB + backend + frontend)
- `.env.example` — Variables de entorno de ejemplo

## Requisitos

- Node.js 22+
- Docker y Docker Compose (para ejecución con contenedores)
- Cuenta en MariaDB o uso del contenedor del compose

## Desarrollo local

### 1. Variables de entorno

```bash
cp .env.example .env
# Edita .env y define al menos JWT_SECRET en producción
```

### 2. Base de datos y backend

Con Docker:

```bash
docker compose up -d mariadb
# Espera a que MariaDB esté healthy, luego:
cd backend
npm install
npx prisma migrate dev --name init
npm run start:dev
```

Sin Docker (MariaDB local):

```bash
# Crea la base de datos y usuario en MariaDB
# En .env (o backend/.env) define DATABASE_URL, por ejemplo:
# DATABASE_URL="mysql://app:app@localhost:3306/activation"

cd backend
npm install
npx prisma migrate dev --name init
npm run start:dev
```

Backend quedará en `http://localhost:4000`. API bajo prefijo `/api`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend en `http://localhost:3000`. Ajusta `NEXT_PUBLIC_API_URL` en `.env` si la API no está en `http://localhost:4000`.

### 4. Primer usuario

Registro vía API:

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"tu@email.com","password":"minimo6","name":"Tu Nombre"}'
```

Luego inicia sesión en la app con ese email y contraseña.

## Despliegue con Docker Compose

```bash
cp .env.example .env
# Configura JWT_SECRET, contraseñas de DB y NEXT_PUBLIC_API_URL (URL pública del backend)
docker compose up -d
```

- Frontend: puerto 3000  
- Backend: puerto 4000  
- MariaDB: puerto 3306 (solo accesible desde host si lo expones)

Para Coolify, despliega cada servicio por separado (frontend, backend, MariaDB) usando los Dockerfiles de `backend/` y `frontend/`, y configura variables de entorno según `.env.example`.

## API (resumen)

- `POST /api/auth/register` — Registro
- `POST /api/auth/login` — Login (devuelve `accessToken`)
- `GET /api/auth/me` — Usuario actual (Bearer token)
- `GET /api/activations` — Lista de activaciones del usuario (Bearer token)
- `GET /api/activations/:id` — Detalle (solo si es del usuario)

Todos los datos de activaciones están filtrados por usuario autenticado en el backend.
