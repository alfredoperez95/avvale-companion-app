# CLAUDE.md — Avvale Companion App

> Guía de referencia completa para asistentes de IA (Cursor, Claude Code, etc.)
> Idioma del código: **español** (labels, logs, comentarios y naming interno están en español).

---

## Codebase at a Glance

| Capa | Tecnología | Puerto |
|------|-----------|--------|
| Backend API | NestJS 10 + TypeScript | 4000 |
| Frontend | Next.js 15 (App Router) + React 19 | 3000 |
| Base de datos | MySQL / MariaDB vía Prisma 6 | 3306 |
| Cola de trabajos | BullMQ sobre Redis | 6379 |
| Integración externa | Make.com (webhook + callback HTTP) | — |

---

## Path Aliases e Imports

### Frontend (`frontend/tsconfig.json`)
```json
"paths": { "@/*": ["./src/*"] }
```

Usar siempre el alias `@/` en el frontend:
- `@/components/[Name]/[Name]` — componentes React
- `@/lib/api` — `apiFetch`, `apiUpload`, `getToken`
- `@/hooks/...` — hooks custom
- `@/contexts/...` — providers de contexto
- `@/styles/...` — CSS global y tokens
- `@/types/...` — tipos TypeScript compartidos

### Backend (`backend/tsconfig.json`)
Sin alias de paths. Imports relativos o desde módulos de NestJS.

---

## Estructura del Repositorio

```
/
├── backend/                   # NestJS API (puerto 4000, prefijo /api)
│   ├── src/
│   │   ├── main.ts            # Bootstrap: ValidationPipe global, CORS, puerto
│   │   ├── app.module.ts      # Módulo raíz (registra todos los módulos)
│   │   ├── health.controller.ts
│   │   ├── activations/
│   │   ├── areas/
│   │   ├── attachments/
│   │   ├── auth/
│   │   ├── billing-admin-contacts/
│   │   ├── config/
│   │   ├── contacts/
│   │   ├── email-signature/
│   │   ├── email-templates/
│   │   ├── health/
│   │   ├── make/
│   │   ├── prisma/
│   │   ├── queue/
│   │   ├── user-config/
│   │   └── users/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/        # 27 migraciones
│   └── scripts/
│       ├── entrypoint.sh      # Docker: prisma migrate deploy && start
│       ├── reset-activations.js
│       └── import-cc-contacts.js
├── frontend/
│   ├── src/
│   │   ├── app/               # Next.js App Router
│   │   │   ├── layout.tsx     # Root layout (lang="es")
│   │   │   ├── login/         # Página pública de login
│   │   │   └── (main)/        # Grupo de rutas autenticadas
│   │   │       ├── layout.tsx # Fetch /api/auth/me, tema, AppShell
│   │   │       ├── launcher/
│   │   │       ├── activations/
│   │   │       ├── admin/
│   │   │       ├── profile/ & perfil/
│   │   │       ├── configuration/
│   │   │       └── demo/icons/
│   │   ├── components/        # 14 componentes reutilizables
│   │   ├── contexts/          # ThemeContext, UserContext
│   │   ├── hooks/             # useSmoothLoading, useAvatarUrl
│   │   ├── lib/               # api.ts, helpers de dominio
│   │   ├── styles/            # tokens.css, tokens-fiori.css
│   │   └── types/             # activation.ts, ui5-webcomponents.d.ts
│   └── next.config.ts
├── docs/
│   ├── MAKE.md                # Payload v4, callback, adjuntos
│   ├── ACTIVATION_STATE_MACHINE.md
│   └── VERIFICACION.md
├── scripts/
│   └── prepare-env.sh         # Propaga .env raíz → backend/.env y frontend/.env
└── .env.example
```

---

## Stack Tecnológico

### Backend

| Capa | Librería |
|------|---------|
| Framework | `@nestjs/core` ^10.4.15 |
| ORM | `@prisma/client` ^6.9.0, `prisma` ^6.9.0 |
| Auth | `@nestjs/jwt` ^10.2.0, `passport-jwt` ^4.0.1, `bcrypt` ^5.1.1 |
| Cola | `@nestjs/bullmq` ^11.0.4, `bullmq` ^5.71.1, `ioredis` ^5.10.1 |
| Validación | `class-validator` ^0.14.1, `class-transformer` ^0.5.1 |
| Config | `@nestjs/config` ^3.3.0 |

### Frontend

| Capa | Librería |
|------|---------|
| Framework | `next` 15.1.0, `react` ^19.0.0 |
| UI Web Components | `@ui5/webcomponents` ^2.20.2 |
| Iconos | `@fluentui/react-icons` ^2.0.250 |
| Editor rico | `@tiptap/react` ^3.20.1 + 9 extensiones |
| Sanitización HTML | `dompurify` ^3.3.3 |
| Estilos | CSS Modules + Custom Properties (sin Tailwind, sin styled-components) |

---

## Setup de Desarrollo

### Prerrequisitos
- Node.js 22+, npm
- MySQL / MariaDB
- Redis (obligatorio para la cola de envíos)
- Docker (opcional, para Redis y MariaDB locales)

### Arranque rápido
```bash
# 1. Configurar entorno
cp .env.example .env
# Editar .env: DATABASE_URL, JWT_SECRET, REDIS_URL, MAKE_WEBHOOK_URL, etc.
chmod +x scripts/prepare-env.sh && ./scripts/prepare-env.sh

# 2. Redis local
cd backend && npm run redis:dev

# 3. Backend
cd backend && npm install
npx prisma migrate deploy && npx prisma generate
npm run start:dev           # → http://localhost:4000

# 4. Frontend (nueva terminal)
cd frontend && npm install
npm run dev                 # → http://localhost:3000

# 5. Primer usuario
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"secret123","name":"Admin"}'
```

### Scripts de referencia

| Ubicación | Comando | Descripción |
|-----------|---------|-------------|
| `backend/` | `npm run start:dev` | Servidor con hot-reload |
| `backend/` | `npm run build` | Build producción (`nest build`) |
| `backend/` | `npm run redis:dev` / `redis:dev:down` | Redis local vía Docker Compose |
| `backend/` | `npm run prisma:migrate` | Crear y aplicar nueva migración |
| `backend/` | `npm run prisma:studio` | Abrir Prisma Studio |
| `backend/` | `npm run reset:activations` | Borrar todas las activaciones + reset autoincrement |
| `backend/` | `npm run import:cc-contacts` | Importar contactos CC desde script |
| `frontend/` | `npm run dev` | Servidor de desarrollo Next.js |
| `frontend/` | `npm run build` | Build de producción |
| `frontend/` | `npm run lint` | ESLint |

---

## Base de Datos — Prisma Schema

**Provider:** MySQL (MariaDB compatible)
**Schema:** `backend/prisma/schema.prisma`

### Enums

```prisma
enum UserRole        { USER  ADMIN }
enum ActivationStatus { DRAFT QUEUED PROCESSING RETRYING PENDING_CALLBACK SENT FAILED }
enum ProjectType     { CONSULTORIA  SW }
```

### Modelos

#### `User` → tabla `users`
| Campo | Tipo | Notas |
|-------|------|-------|
| id | String (uuid) | PK |
| email | String @unique | |
| passwordHash | String | mapeado `password_hash` |
| role | UserRole | default USER |
| name, lastName | String? | `last_name` |
| position | String? | |
| phone | String? | |
| appearance | String? | `"microsoft"` o `"fiori"` |
| avatarPath | String? | `avatar_path` |
| enabled | Boolean | default true |
| createdAt | DateTime | `created_at` |

Relaciones: `activations[]`, `emailTemplates[]`, `emailSignature?`, `ownedAreas[]`

#### `Activation` → tabla `activations`
| Campo | Tipo | Notas |
|-------|------|-------|
| id | String (uuid) | PK |
| activationNumber | Int @unique @autoincrement | `activation_number` UnsignedInt |
| status | ActivationStatus | default DRAFT |
| createdByUserId | String | FK → users |
| createdBy | String | label (email del creador) |
| recipientTo | String @db.Text | JSON array serializado |
| recipientCc | String? @db.Text | |
| subject | String | |
| projectName | String | `project_name` |
| client | String? | |
| offerCode | String | `offer_code` |
| projectAmount | String? | `project_amount` |
| projectType | ProjectType? | |
| hubspotUrl | String? | `hubspot_url` |
| projectJpName/Email/Source | String? | datos del JP |
| body | String? @db.Text | HTML del cuerpo del email |
| attachmentUrls/Names | String? @db.Text | JSON arrays |
| makeSentAt, makeRunId | DateTime?, String? | |
| errorMessage | String? @db.Text | |
| queuedAt, processingStartedAt, lastStatusAt | DateTime? | timestamps de estado |
| sendAttemptCount | Int | default 0 |
| bullJobId | String? | ID del job en Redis |

Relaciones: `activationAreas[]`, `activationSubAreas[]`, `attachments[]`

#### `ActivationAttachment` → `activation_attachments`
| Campo | Tipo |
|-------|------|
| id | uuid |
| activationId | FK → activations |
| originalUrl | String @db.Text |
| storedPath | String (ruta en disco) |
| fileName | String |
| contentType | String? |
| publicToken | String? @unique |
| publicExpiresAt, publishedAt | DateTime? |

#### `Area` → `areas`
- `ownerUserId = null` → plantilla del sistema (solo ADMIN edita)
- `ownerUserId = user_id` → copia personal del usuario

#### `SubArea` → `sub_areas` (pertenece a Area)

#### `SubAreaContact` → `sub_area_contacts`
- `isProjectJp: Boolean` — si es contacto JP del proyecto

#### `CcContact` → `cc_contacts` (pool global de CC)
#### `BillingAdminContact` → `billing_admin_contacts`

#### `EmailTemplate` → `email_templates`
- `userId = null` → plantilla de sistema (solo ADMIN)
- `content: String @db.LongText`

#### `EmailSignature` → `email_signature`
- Una fila por usuario (`userId @unique`)
- `content: String @db.LongText`

### Workflow Prisma
```bash
# Tras modificar schema.prisma:
cd backend
npm run prisma:migrate   # crea y aplica migración
npx prisma generate      # regenera Prisma Client
```

---
## Arquitectura Backend — Módulos en Detalle

### Convenciones globales del backend

- **Prefijo global API:** `/api` (definido en `main.ts`)
- **ValidationPipe global:** `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`
- **CORS:** orígenes desde `CORS_ORIGIN` (separados por coma); requests sin `Origin` siempre permitidos
- **Puerto:** `process.env.PORT ?? 4000`
- **Logger:** `private readonly logger = new Logger(ClassName.name)` en cada servicio
- **PKs:** todas UUID (`String @id @default(uuid())`)
- **Roles:** `USER` (default registro público) | `ADMIN` (asignar en BD)
- **Sin tests:** no hay archivos de test; no generar boilerplate de tests salvo que se pida

---

### `auth/` — Autenticación

**Archivos:**
```
auth/
├── auth.controller.ts      @Controller('auth')
├── auth.module.ts
├── auth.service.ts
├── decorators/
│   ├── current-user.decorator.ts   @CurrentUser()
│   └── user-payload.ts             interface UserPayload
├── dto/
│   ├── login.dto.ts
│   ├── register.dto.ts
│   └── update-profile.dto.ts
├── guards/
│   ├── jwt-auth.guard.ts    JwtAuthGuard extends AuthGuard('jwt')
│   └── admin.guard.ts       AdminGuard implements CanActivate
└── strategies/
    └── jwt.strategy.ts
```

**`UserPayload` interface:**
```typescript
interface UserPayload { userId: string; email: string; role: string }
```

**`AuthService` — métodos principales:**
```typescript
register(dto: RegisterDto): Promise<{ accessToken, user }>
login(dto: LoginDto): Promise<{ accessToken, user }>
updateProfile(userId, data: UpdateProfileDto): Promise<User>
setAvatar(userId, file): Promise<{ avatarPath }>
getAvatarBuffer(userId): Promise<{ buffer, contentType }>
removeAvatar(userId): Promise<void>
getLoginBranding(): { appearance: 'microsoft' | 'fiori' }
```

**DTOs:**
```typescript
// LoginDto
{ email: string (IsEmail), password: string (MinLength 6) }

// RegisterDto
{ email: string (IsEmail), password: string (MinLength 6), name?: string }

// UpdateProfileDto
{
  name?: string
  lastName?: string
  position?: string
  phone?: string
  appearance?: string  // IsIn(['microsoft', 'fiori'])
}
```

**Endpoints `@Controller('auth')`:**
| Método | Ruta | Guard | Descripción |
|--------|------|-------|-------------|
| POST | `/register` | — | Alta usuario → `{ accessToken, user }` |
| POST | `/login` | — | Login → `{ accessToken, user }` |
| GET | `/branding` | — | `{ appearance }` para página de login |
| GET | `/me` | JWT | Perfil del usuario autenticado |
| PATCH | `/me` | JWT | Actualizar perfil |
| POST | `/me/avatar` | JWT | Subir foto de perfil (FileInterceptor) |
| GET | `/me/avatar` | JWT | Descargar avatar (binario) |
| DELETE | `/me/avatar` | JWT | Eliminar avatar |

---

### `users/` — Gestión de usuarios (solo ADMIN)

**`UsersService` — métodos:**
```typescript
findAll(): Promise<User[]>                          // excluye passwordHash
findById(id: string): Promise<User>
findByEmail(email: string): Promise<User>
createByAdmin(dto: CreateUserByAdminDto): Promise<User>
updateByAdmin(id, dto: UpdateUserByAdminDto): Promise<User>
```

**DTOs:**
```typescript
// CreateUserByAdminDto
{
  email: string (IsEmail)
  password: string (MinLength 6)
  name: string
  lastName: string
  position: string
  role?: UserRole  // IsEnum(UserRole)
}

// UpdateUserByAdminDto
{
  email?: string
  position?: string
  role?: UserRole
  enabled?: boolean
  newPassword?: string (MinLength 6)
}
```

**Endpoints `@Controller('users')` [JwtAuthGuard, AdminGuard]:**
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Lista todos los usuarios |
| POST | `/` | Crear usuario (admin) |
| PATCH | `/:id` | Actualizar usuario |

---

### `activations/` — Módulo principal de negocio

**Archivos:**
```
activations/
├── activations.controller.ts
├── activations.module.ts
├── activations.service.ts
├── activation-lookup.service.ts    findOneByIdAndUser con acceso a admin
├── activation-send.orchestrator.ts llama a Make, gestiona transición de estado
├── activation-code.ts              formatea número → "ACT-000123"
├── email-html.util.ts              normalizeEmailHtmlSpacing()
└── dto/
    ├── create-activation.dto.ts
    └── update-activation.dto.ts
```

**`ActivationsService` — métodos:**
```typescript
create(userId, createdByLabel, dto: CreateActivationDto): Promise<Activation>
findAllByUser(userId, filters?: { status }): Promise<Activation[]>
findAllForAdmin(filters?: { status }): Promise<Activation[]>
findOneByIdAndUser(id, userId): Promise<Activation>  // ADMIN ve cualquiera
findOneById(id): Promise<Activation>
update(id, userId, dto: UpdateActivationDto): Promise<Activation>
remove(id, userId): Promise<void>
requestSend(id, userId): Promise<void>               // encola el job
previewProjectJp(userId, areaIds, subAreaIds, jpContactId, jpAutoSubAreaContactId)
```

**`CreateActivationDto`:**
```typescript
{
  projectName: string
  client?: string
  offerCode: string
  projectAmount?: string
  projectType?: 'CONSULTORIA' | 'SW'
  hubspotUrl?: string
  areaIds: string[]          // UUIDs de áreas
  subAreaIds?: string[]
  subject?: string
  recipientCc?: string       // emails separados por coma
  body?: string              // HTML con shortcodes
  attachmentUrls?: string    // JSON array serializado
  attachmentNames?: string   // JSON array serializado
  projectJpContactId?: string
  projectJpAutoSubAreaContactId?: string
}
```

**Endpoints `@Controller('activations')` [JwtAuthGuard]:**
| Método | Ruta | Notas |
|--------|------|-------|
| POST | `/` | Crear activación en DRAFT |
| GET | `/` | Lista (ADMIN ve todas, USER solo las suyas) |
| GET | `/project-jp-preview` | Preview del JP según áreas/subáreas |
| GET | `/:id` | Detalle (ADMIN ve cualquiera) |
| PATCH | `/:id` | Actualizar borrador |
| DELETE | `/:id` | Eliminar |
| POST | `/:id/send` | Encolar envío a Make |
| GET | `/:id/attachments` | Listar adjuntos |
| POST | `/:id/attachments/upload` | Subir archivo (FileInterceptor) |
| GET | `/:id/attachments/:attachmentId` | Descargar adjunto |
| DELETE | `/:id/attachments/:attachmentId` | Eliminar adjunto |

**`ActivationSendOrchestrator.deliverActivationToMake(activationId, userId)`:**
1. Busca la activación y valida estado (QUEUED / PROCESSING / RETRYING)
2. Obtiene la firma de email del usuario
3. Construye payload Make v4 con `buildMakeWebhookPayload()`
4. Normaliza espacios HTML con `normalizeEmailHtmlSpacing()`
5. Si no hay adjuntos, **elimina** el campo `attachments` del payload (no envía `[]`)
6. Llama a `MakeService.triggerWebhook(payload)`
7. En éxito: `updateMany` con filtro de estado → `PENDING_CALLBACK`
   - Protección de carrera: si el callback llega antes, el estado ya es SENT y no se pisa

---

### `queue/` — BullMQ

**Constantes (`queue.constants.ts`):**
```typescript
export const ACTIVATION_SEND_QUEUE = 'activation-send'
export const ACTIVATION_SEND_JOB_NAME = 'send'
```

**Payload del job (`types/send-activation-job.payload.ts`):**
```typescript
class SendActivationJobPayload {
  @IsUUID('4') activationId: string
  @IsUUID('4') userId: string
}
```

**Configuración Redis (`bullmq.config.ts`):**
- Acepta `REDIS_URL` (redis://[:password@]host:port/db) o variables individuales
  `REDIS_HOST`, `REDIS_PORT`, `REDIS_DB`, `REDIS_PASSWORD`
- Job defaults: `{ attempts: 5, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true, removeOnFail: false }`
- Configurable: `ACTIVATION_SEND_QUEUE_ATTEMPTS`, `ACTIVATION_SEND_QUEUE_BACKOFF_MS`

**`ActivationSendProducer`:**
```typescript
enqueueSendActivation(payload: SendActivationJobPayload): Promise<string>
// retorna jobId = `send-activation-{activationId}`
```

**`ActivationSendProcessor` (WorkerHost):**
- `process(job)`: actualiza estado → PROCESSING, llama al orquestador
- `onFailed(job, err)`: actualiza estado → FAILED, guarda errorMessage (truncado a 500 chars para MariaDB)

---

### `make/` — Integración Make.com

**Archivos:**
```
make/
├── make.module.ts
├── make.service.ts
├── make-webhook-payload.ts     buildMakeWebhookPayload(), MAKE_WEBHOOK_SCHEMA_VERSION = 4
├── make-callback.controller.ts  POST /api/webhooks/make/callback
└── dto/
    └── make-callback.dto.ts
```

**`MakeCallbackDto`:**
```typescript
{
  secret: string                    // debe coincidir con MAKE_CALLBACK_SECRET
  activationId: string (IsUUID)
  activationNumber?: number (IsInt)
  activationCode?: string
  status: 'sent' | 'error'         // IsIn(['sent', 'error'])
  errorMessage?: string
}
```

**`MakeService`:**
```typescript
triggerWebhook(payload: MakeWebhookPayloadV1): Promise<MakeWebhookResult>
handleActivationCallback(dto: MakeCallbackDto): Promise<void>
// Watchdog interno: cada 5s marca como FAILED las activaciones en PENDING_CALLBACK
// más antiguas que MAKE_PENDING_CALLBACK_TIMEOUT_MS (default 30000ms)
```

**Endpoint `@Controller('webhooks/make')`:**
| Método | Ruta | Guard | Descripción |
|--------|------|-------|-------------|
| POST | `/callback` | — | Callback de Make → actualiza estado SENT/FAILED |

---

### `areas/` — Catálogo de Áreas y Subáreas

**Endpoints `@Controller('areas')` [JwtAuthGuard]:**
| Método | Ruta | Guard extra | Descripción |
|--------|------|-------------|-------------|
| GET | `/` | — | Lista áreas (query: `?admin`, `?withSubareas`) |
| POST | `/` | Admin | Crear área |
| PATCH | `/:id` | Admin | Actualizar área |
| DELETE | `/:id` | Admin | Eliminar área |
| GET | `/:id/subareas` | Admin | Lista subáreas de un área |
| POST | `/:id/subareas` | Admin | Crear subárea |
| PATCH | `/subareas/:subAreaId` | Admin | Actualizar subárea |
| DELETE | `/subareas/:subAreaId` | Admin | Eliminar subárea |
| GET | `/subareas/:subAreaId/contacts` | Admin | Contactos de una subárea |
| POST | `/subareas/:subAreaId/contacts` | Admin | Crear contacto |
| PATCH | `/subareas/contacts/:contactId` | Admin | Actualizar contacto |
| DELETE | `/subareas/contacts/:contactId` | Admin | Eliminar contacto |

---

### `contacts/` y `billing-admin-contacts/`

**ContactsController** (`@Controller('contacts')`) — gestión de CcContacts:
- GET `/` [JWT] — lista contactos CC
- POST, PATCH `/:id`, DELETE `/:id` [JWT + Admin]

**BillingAdminContactsController** (`@Controller('billing-admin-contacts')`) [JWT + Admin]:
- GET, POST, PATCH `/:id`, DELETE `/:id`

---

### `email-templates/` y `email-signature/`

**`EmailTemplatesService`:**
```typescript
findAll(user, systemScope: boolean): Promise<EmailTemplate[]>
create(user, dto, asSystem: boolean): Promise<EmailTemplate>
  // asSystem=true y rol ADMIN → userId=null (plantilla de sistema)
update(user, id, dto: UpdateEmailTemplateDto): Promise<EmailTemplate>
remove(user, id): Promise<void>
restorePersonalFromSystem(user): Promise<EmailTemplate[]>
  // Clona las plantillas de sistema al usuario
```

**`EmailSignatureService`:**
```typescript
getContent(userId): Promise<string>          // firma del usuario
getSystemTemplateContent(): Promise<string>  // firma de sistema (userId=null)
upsertForUser(userId, dto): Promise<EmailSignature>
upsertSystemTemplate(dto): Promise<EmailSignature>
```

**Endpoints email-signature `@Controller('email-signature')`:**
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` [?scope=system] | Obtener firma |
| PUT | `/` [?scope=system] | Guardar firma |

---

### `attachments/` — Gestión de Archivos

**`AttachmentsService`:**
```typescript
saveUploadedFile(activationId, file, originalUrl?): Promise<ActivationAttachment>
saveActivationAttachments(activationId, urls: string[]): Promise<void>  // descarga desde URL
getAttachmentFile(activationId, attachmentId): Promise<{ buffer, fileName, contentType }>
getAttachmentsByActivationId(activationId): Promise<ActivationAttachment[]>
deleteAttachment(activationId, attachmentId): Promise<void>
schedulePublicExpiryForActivation(activationId, days): Promise<void>
clearExpiredPublicAccess(): Promise<void>  // se llama en onModuleDestroy
```

**Endpoint público (sin auth):**
- `GET /api/public/attachments/:token` — descarga adjunto por token temporal (para Make)

---

### `user-config/` — Bootstrap de usuario

**`UserConfigService.ensureUserDefaults(userId)`:**
- Clona plantillas de email de sistema al usuario (si no tiene)
- Clona firma de sistema al usuario (si no tiene)
- Retorna `{ didClone: boolean }`

**Endpoint:**
- `POST /api/user-config/bootstrap` [JWT] — llamado automáticamente al cargar la app

---

### `health/` y `health.controller.ts`

- `GET /api/health` → `{ status: 'ok', database: 'connected' }`

---

## Máquina de Estados de Activación

```
DRAFT
  └─(requestSend)─→ QUEUED (job creado en Redis)
                      └─(worker procesa)─→ PROCESSING
                                             └─(POST a Make OK)─→ PENDING_CALLBACK
                                             │                       ├─(callback 'sent')─→ SENT ✓
                                             │                       └─(callback 'error' / watchdog)─→ FAILED ✗
                                             └─(POST a Make falla)─→ RETRYING (BullMQ reintenta)
                                                                        └─(max reintentos)─→ FAILED ✗
```

**Transiciones válidas:**
- DRAFT → QUEUED (via `requestSend`)
- QUEUED / RETRYING → PROCESSING (worker BullMQ)
- PROCESSING → PENDING_CALLBACK (Make aceptó el webhook)
- PROCESSING → RETRYING (Make rechazó, BullMQ reintenta)
- PENDING_CALLBACK → SENT (callback `status: 'sent'`)
- PENDING_CALLBACK / PROCESSING / RETRYING → FAILED (callback `status: 'error'` o watchdog)

Ver tabla completa: `docs/ACTIVATION_STATE_MACHINE.md`

---

## Arquitectura Frontend — Detalle Completo

### Routing (App Router Next.js 15)

```
app/
├── layout.tsx                  Root: <html lang="es">, imports globals.css
├── page.tsx                    Redirige a /login o /launcher
├── login/
│   └── page.tsx                Formulario login; fetch /api/auth/branding para tema; guarda token en localStorage
└── (main)/                     Grupo de rutas autenticadas (no añade segmento a URL)
    ├── layout.tsx              'use client'; fetch /api/auth/me; redirige a /login si 401; ThemeProvider + UserProvider + AppShell
    ├── loading.tsx             Spinner de carga
    ├── launcher/
    │   ├── page.tsx            App Launcher (acceso a apps)
    │   ├── loading.tsx
    │   └── activations/        App de Activaciones (tema Fiori: pestañas superiores)
    │       ├── loading.tsx
    │       ├── dashboard/page.tsx      KPIs y resumen
    │       ├── activate/
    │       │   ├── page.tsx            Lista de activaciones
    │       │   ├── new/page.tsx        Nueva activación
    │       │   └── [id]/
    │       │       ├── page.tsx        Detalle de activación
    │       │       └── edit/page.tsx   Editar borrador
    │       └── configuration/
    │           ├── page.tsx            Hub de configuración
    │           ├── areas/page.tsx      Gestión de áreas
    │           ├── contacts/page.tsx   Contactos CC
    │           ├── email-templates/page.tsx
    │           ├── email-signature/page.tsx
    │           └── billing-admin/page.tsx
    ├── activations/            Rutas espejo (tema Microsoft: sidebar)
    │   ├── page.tsx            → redirige a /launcher/activations/activate
    │   ├── new/page.tsx        → redirige a /launcher/activations/activate/new
    │   └── [id]/
    │       ├── page.tsx
    │       └── edit/page.tsx
    ├── configuration/          Rutas espejo de configuración
    │   ├── page.tsx
    │   ├── areas/page.tsx
    │   ├── contacts/page.tsx
    │   ├── email-templates/page.tsx
    │   ├── firma/page.tsx
    │   └── billing-admin/page.tsx
    ├── admin/page.tsx          Gestión de usuarios (solo ADMIN)
    ├── profile/page.tsx        Perfil del usuario
    ├── perfil/page.tsx         Alias español de /profile
    └── demo/icons/page.tsx     Catálogo de iconos
```

**Nota sobre rutas espejo:** Existen dos árboles (`/launcher/activations/` y `/activations/`, `/configuration/`) que sirven las mismas páginas con diferente shell:
- `/launcher/activations/...` → AppShell Fiori (tabs horizontales en cabecera)
- `/activations/...` y `/configuration/...` → AppShell Microsoft (sidebar vertical)

---

### `(main)/layout.tsx` — Layout principal autenticado

```typescript
// 'use client'
// Responsabilidades:
// 1. Fetch GET /api/auth/me con timeout de 20s
// 2. Redirige a /login si 401 o token inválido
// 3. Llama POST /api/user-config/bootstrap (sin await, fire & forget)
// 4. Gestiona estado del tema: 'microsoft' | 'fiori'
// 5. Persiste tema en cookie y atributo data-appearance en <html>
// 6. Escucha eventos: 'theme-changed', 'user-updated'
// 7. Renderiza ThemeProvider > UserProvider > AppShell > {children}
// 8. Usa useSmoothLoading(loading, { delayMs: 150, minVisibleMs: 250 })
```

---

### Contextos

**`contexts/ThemeContext.tsx`:**
```typescript
export type Theme = 'microsoft' | 'fiori'
export function ThemeProvider({ theme, children }: { theme: Theme; children: React.ReactNode })
export function useTheme(): Theme
```

**`contexts/UserContext.tsx`:**
```typescript
export type User = {
  id: string; email: string; name?: string | null; lastName?: string | null
  position?: string | null; avatarPath?: string | null
  appearance?: string | null; role?: string
}
export function UserProvider({ user, children }: { user: User | null; children: React.ReactNode })
export function useUser(): User | null
```

---

### Componentes (`src/components/`)

Cada componente vive en su propio directorio con CSS Module co-localizado.

#### `AppShell/AppShell.tsx`
- Shell principal: sidebar (Microsoft) o tabs (Fiori)
- Props: `{ user, theme, children }`
- Gestiona navegación, logout, cambio de tema

#### `DataTable/DataTable.tsx`
```typescript
interface Column<T> {
  key: string
  header: string
  renderHeader?(): ReactNode
  minWidthPx?: number
  render(row: T): ReactNode
}
interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  emptyMessage?: string
  getRowId(row: T): string
  onRowClick?(row: T): void
}
export function DataTable<T>({ ... }): JSX.Element
```

#### `DetailDrawer/DetailDrawer.tsx`
- Panel deslizante lateral para detalle de activación
- Muestra estado, adjuntos, historial y acciones

#### `StatusTag/StatusTag.tsx`
- Badge de estado de activación con colores:
  - DRAFT → gris
  - QUEUED / PROCESSING / RETRYING → azul / amarillo
  - PENDING_CALLBACK → naranja
  - SENT → verde
  - FAILED → rojo

#### `FilterBar/FilterBar.tsx`
- Barra de filtros con dropdown de estado y búsqueda por texto
- Exporta `SolicitanteOption` type

#### `RichTextEditor/RichTextEditor.tsx`
- Editor TipTap con extensiones: Bold, Italic, Underline, Strike, Color, Link, Image, Table, Placeholder
- Resaltado de shortcodes `{{variable}}` como chips visuales
- Paleta de 9 colores para texto
- Props: `{ content, onChange, placeholder?, variables?, readOnly? }`

#### `AttachmentGrid/`
- Grid de adjuntos con previsualización, descarga y eliminación

#### `ConfirmDialog/`
- Dialog de confirmación reutilizable
- Props: `{ open, title, message, onConfirm, onCancel }`

#### `KpiCard/`
- Tarjeta de métrica con valor, etiqueta e icono

#### `Icon/`
- Wrapper sobre `@fluentui/react-icons`
- Props: `{ name: string, size?: number }`

#### `LoadingScreen/`
```typescript
interface LoadingScreenProps {
  message?: string
  fullPage?: boolean   // default true
}
```

#### `PhoneCountryPicker/`
- Selector de prefijo telefónico con banderas
- Usa `country-flag-icons` y `phone-country-codes.ts`

#### `OfferCodeTableCell/`
- Celda de tabla que trunca/expande el código de oferta

#### `Footer/`
- Pie de página de la aplicación

---

### Hooks (`src/hooks/`)

**`useSmoothLoading(loading, options?)`:**
```typescript
// Evita parpadeos de spinner: no muestra el loader hasta delayMs,
// y una vez visible lo mantiene mínimo minVisibleMs
export function useSmoothLoading(
  loading: boolean,
  options?: { delayMs?: number; minVisibleMs?: number }  // defaults: 150ms, 250ms
): boolean
```

**`useAvatarUrl(user?)`:**
```typescript
// Retorna URL del avatar o iniciales del usuario
export function useAvatarUrl(user?: { avatarPath?: string | null; name?: string | null }): string
```

---

### Librería de utilidades (`src/lib/`)

**`api.ts`** — Único punto de entrada para llamadas al backend:
```typescript
// En desarrollo: baseUrl = '' (mismo origen, Next.js reescribe /api/* → :4000)
// En producción: baseUrl = NEXT_PUBLIC_API_URL
export function getToken(): string | null          // lee localStorage('token')
export function apiFetch(path: string, init?: RequestInit): Promise<Response>
  // Inyecta Authorization: Bearer {token}
export function apiUpload(path, formData, onProgress?): Promise<Response>
  // Usa XMLHttpRequest para tracking de progreso de subida
```

**`activation-payload.ts`:**
```typescript
export interface ActivationPayloadFromExtension {
  projectName?; offerCode?; hubspotUrl?; client?; amount?
  projectManagerEmail?; serviceType?; attachmentUrls?; attachmentNames?
}
// Lee y decodifica payload base64url desde window.location.hash
// (usado para prellenar formulario desde extensión de Chrome)
export function getActivationPayloadFromHash(): ActivationPayloadFromExtension | null
```

**`replace-template-variables.ts`:**
```typescript
export const TEMPLATE_SHORTCODES = [
  { value: '{{nombreProyecto}}', label: 'Nombre del proyecto' },
  { value: '{{cliente}}', label: 'Cliente' },
  { value: '{{codigoOferta}}', label: 'Código de oferta' },
  { value: '{{importeProyecto}}', label: 'Importe del proyecto' },
  { value: '{{tipoOportunidad}}', label: 'Tipo de oportunidad' },
  { value: '{{urlHubSpot}}', label: 'URL HubSpot' },
  { value: '{{Saludo}}', label: 'Saludo automático' },
  { value: '{{JP de Proyecto}}', label: 'JP de Proyecto' },
  { value: '{{urlsEscaneadas}}', label: 'URLs escaneadas' },
]

export type TemplateVariables = {
  projectName: string; client?: string; offerCode: string
  projectAmount?: string; projectType?: string; hubspotUrl?: string
  saludo?: string; projectJpName?: string; projectJpEmail?: string
  scannedUrls?: { url: string; name: string }[]
  hasUploadedAttachments?: boolean
}

export function replaceTemplateVariables(html: string, values: TemplateVariables): string
export function replaceUrlsEscaneadasPlaceholder(html: string, values: TemplateVariables): string
export function getTimeBasedGreeting(date?: Date): string
  // 6-13h → "Buenos días a todos", 13-21h → "Buenas tardes a todos", resto → "Buenas noches a todos"
```

**`activation-code.ts`:**
```typescript
// 123 → "ACT-000123"
export function formatActivationCode(num: number): string
```

**`appearance-cookie.ts`:**
```typescript
export function getAppearanceFromCookie(): 'microsoft' | 'fiori' | null
export function setAppearanceCookie(theme: 'microsoft' | 'fiori'): void
export function clearAppearanceCookie(): void
```

**`activation-attachment-urls.ts`** — helpers para parsear URLs de adjuntos desde JSON string
**`activation-attachment-warning.ts`** — lógica para mostrar advertencias sobre adjuntos
**`activation-error-message.ts`** — formatea mensajes de error de activación
**`parse-project-name.ts`** — parsea nombre de proyecto desde string
**`offer-code-display.ts`** — trunca y formatea código de oferta para tabla
**`phone-country-codes.ts`** — lista de prefijos telefónicos por país

---

### Tipos (`src/types/`)

**`activation.ts`:**
```typescript
export type ActivationStatus =
  | 'DRAFT' | 'QUEUED' | 'PROCESSING' | 'RETRYING'
  | 'PENDING_CALLBACK' | 'SENT' | 'FAILED'

export const ACTIVATION_IN_FLIGHT_STATUSES: ActivationStatus[] =
  ['QUEUED', 'PROCESSING', 'RETRYING', 'PENDING_CALLBACK']

export interface Activation {
  id: string
  activationNumber: number
  status: ActivationStatus
  projectName: string
  client?: string | null
  offerCode: string
  projectAmount?: string | null
  projectType?: 'CONSULTORIA' | 'SW' | null
  hubspotUrl?: string | null
  body?: string | null
  attachmentUrls?: string | null  // JSON string
  attachmentNames?: string | null // JSON string
  recipientTo: string             // JSON string
  recipientCc?: string | null
  subject: string
  createdAt: string
  createdBy: string
  createdByUserId: string
  createdByUser?: { name?: string; lastName?: string; email: string }
  makeSentAt?: string | null
  makeRunId?: string | null
  errorMessage?: string | null
  activationAreas?: { area: { id: string; name: string } }[]
  activationSubAreas?: { subArea: { id: string; name: string; areaId: string } }[]
  attachments?: ActivationAttachment[]
}
```

**`ui5-webcomponents.d.ts`:** Declaraciones de tipos para elementos HTML custom de SAP UI5.

---

## CSS y Sistema de Temas

### Mecanismo de temas

1. `document.documentElement.setAttribute('data-appearance', 'microsoft' | 'fiori')`
2. Los tokens CSS se aplican mediante el selector `[data-appearance="fiori"]`
3. El tema se persiste en una cookie con `setAppearanceCookie()`
4. El usuario puede cambiar el tema en su perfil (guardado en `user.appearance`)
5. Se propaga a través de `ThemeContext` y el evento custom `theme-changed`

### `styles/tokens.css` — Tema Microsoft (default)

Variables CSS principales:

```css
/* Shell (cabecera) */
--fiori-shell-bg: #0a6ed1
--fiori-shell-text: #fff
--fiori-shell-height: 3rem

/* Navegación lateral */
--fiori-nav-bg: #f7f7f7
--fiori-nav-width: 15rem

/* Contenido */
--fiori-content-bg: #f7f7f7
--fiori-surface: #fff
--fiori-text: #32363a
--fiori-text-secondary: #6a6d70

/* Estado (semáforo) */
--fiori-success: #107e3e
--fiori-error: #bb0000
--fiori-warning: #e9730c
--fiori-information: #0a6ed1

/* Espaciado (base 4px) */
--fiori-space-1: 0.25rem   /* 4px */
--fiori-space-2: 0.5rem    /* 8px */
--fiori-space-3: 0.75rem   /* 12px */
--fiori-space-4: 1rem      /* 16px */
--fiori-space-6: 1.5rem    /* 24px */
--fiori-space-8: 2rem      /* 32px */

/* Sombras */
--fiori-shadow-1: 0 1px 4px rgba(0,0,0,.12)
--fiori-shadow-2: 0 4px 16px rgba(0,0,0,.16)

/* Drawer */
--fiori-drawer-width: 28rem

/* Enlace */
--fiori-link: #0854a0
```

### `styles/tokens-fiori.css` — Tema SAP Fiori (override)

```css
[data-appearance="fiori"] {
  --fiori-shell-bg: #1d2d3e       /* más oscuro */
  --fiori-nav-bg: #f5f6f7
  --fiori-link: #0064d9
  /* sombras más suaves */
}
```

### UI5 Web Components

Importados como side-effects:
```typescript
import '@ui5/webcomponents/dist/Button.js'
import '@ui5/webcomponents/dist/Input.js'
// etc.
```
Los tipos TypeScript están en `src/types/ui5-webcomponents.d.ts`.

### Iconos Fluent UI
```typescript
// Componente Icon wrapper:
import { Icon } from '@/components/Icon/Icon'
<Icon name="Send24Regular" size={20} />
```

---

## Payload Make.com v4

Schema enviado por `MakeService.triggerWebhook()` al webhook de Make:

```typescript
interface MakeWebhookPayloadV1 {
  schemaVersion: 4                    // siempre 4
  activationId: string                // UUID
  activationNumber: number            // ej: 123
  activationCode: string              // "ACT-000123"
  emailSignature: string | null       // HTML de la firma del usuario
  
  // Destinatarios (múltiples formatos para compatibilidad con Make/Outlook)
  recipientTo: string[]               // ["email1@example.com", "email2@example.com"]
  recipientToCsv: string             // "email1@example.com, email2@example.com"
  toRecipients: { address: string }[] // [{ address: "email1@example.com" }]
  
  recipientCc: string[]
  recipientCcCsv: string | null
  ccRecipients: { address: string }[]
  
  subject: string
  body: string | null                 // HTML; shortcodes reemplazados, urlsEscaneadas inyectadas
  
  projectName: string
  client: string | null
  offerCode: string
  projectAmount: string | null        // formato: "3.500,00 €"
  projectType: 'CONSULTORIA' | 'SW' | null
  hubspotUrl: string | null
  
  createdBy: string                   // email del creador
  createdByUser: { name: string; lastName: string; email: string }
  
  areas: { id: string; name: string }[]
  subAreas: { id: string; name: string; areaId: string; areaName: string }[]
  
  // IMPORTANTE: este campo se ELIMINA del payload si no hay adjuntos
  // (Make distingue campo ausente de [] vacío en su routing)
  attachments?: { url: string; fileName: string }[]
}
```

### Shortcodes reemplazados en `body`

| Shortcode | Reemplazado por |
|-----------|----------------|
| `{{nombreProyecto}}` | projectName |
| `{{cliente}}` | client |
| `{{codigoOferta}}` | offerCode |
| `{{importeProyecto}}` | projectAmount formateado con `.` miles, `,` decimales + `€` |
| `{{tipoOportunidad}}` | `"Consultoría"` o `"Software"` |
| `{{urlHubSpot}}` | `<a href="...">ver en HubSpot</a>` |
| `{{Saludo}}` | Saludo según hora (`getTimeBasedGreeting()`) |
| `{{JP de Proyecto}}` | Nombre con mailto link si existe JP |
| `{{urlsEscaneadas}}` | HTML con links a adjuntos escaneados (solo si no hay adjuntos subidos) |

### Callback de Make → Backend

Make llama a `POST /api/webhooks/make/callback`:
```json
{
  "secret": "valor-de-MAKE_CALLBACK_SECRET",
  "activationId": "uuid",
  "activationNumber": 123,
  "status": "sent",        // o "error"
  "errorMessage": null     // solo si status="error"
}
```

---

## Variables de Entorno

Fuente única: `.env` en la raíz, propagado por `./scripts/prepare-env.sh`.

| Variable | Servicio | Obligatorio | Descripción |
|----------|---------|-------------|-------------|
| `DATABASE_URL` | Backend | ✓ | `mysql://USER:PASS@HOST:3306/DB` |
| `JWT_SECRET` | Backend | ✓ | Clave HMAC para JWT (mínimo 32 chars en producción) |
| `JWT_EXPIRES_IN` | Backend | — | Caducidad del token (ej: `7d`) |
| `CORS_ORIGIN` | Backend | Prod | Orígenes permitidos separados por coma |
| `NEXT_PUBLIC_API_URL` | Frontend | Prod | URL pública del backend (build-time para Docker) |
| `BACKEND_PUBLIC_URL` | Backend | — | URL base del backend para URLs de adjuntos enviadas a Make |
| `REDIS_URL` | Backend | ✓ | `redis://[:pass@]host:port/db` |
| `REDIS_HOST` | Backend | — | Alternativa a REDIS_URL |
| `REDIS_PORT` | Backend | — | Default 6379 |
| `REDIS_DB` | Backend | — | Default 0 |
| `REDIS_PASSWORD` | Backend | — | |
| `BULL_PREFIX` | Backend | — | Prefijo Redis (default: `avvale`) |
| `ACTIVATION_SEND_QUEUE_ATTEMPTS` | Backend | — | Reintentos BullMQ (default: 5) |
| `ACTIVATION_SEND_QUEUE_BACKOFF_MS` | Backend | — | Backoff exponencial base (default: 5000) |
| `MAKE_WEBHOOK_URL` | Backend | ✓ | URL Custom Webhook de Make.com |
| `MAKE_WEBHOOK_TIMEOUT_MS` | Backend | — | Timeout POST a Make (default: 30000ms) |
| `MAKE_WEBHOOK_SECRET` | Backend | — | Cabecera `X-Webhook-Secret` opcional |
| `MAKE_CALLBACK_SECRET` | Backend | Prod | Secreto en cuerpo del callback Make→backend |
| `MAKE_PENDING_CALLBACK_TIMEOUT_MS` | Backend | — | Watchdog timeout (default: 30000ms) |
| `ATTACHMENTS_DIR` | Backend | — | Directorio de adjuntos (default: `./uploads`) |
| `PORT` | Backend | — | Puerto del servidor (default: 4000) |
| `DEFAULT_APPEARANCE` | Backend | — | Tema por defecto del login |
| `LOGIN_APPEARANCE` | Backend | — | Tema para la página de login |

---

## Docker y Producción

### Backend (`backend/Dockerfile`)
- Multi-stage build
- Entrypoint (`backend/scripts/entrypoint.sh`): ejecuta `npx prisma migrate deploy` antes de arrancar
- Variables inyectadas en runtime (no en build time)

```bash
cd backend
docker build -t activation-backend .
docker run -d   -e DATABASE_URL="mysql://..."   -e JWT_SECRET="..."   -e REDIS_URL="redis://..."   -e CORS_ORIGIN="https://app.example.com"   -e MAKE_WEBHOOK_URL="https://hook.eu1.make.com/..."   -e MAKE_CALLBACK_SECRET="..."   -e BACKEND_PUBLIC_URL="https://api.example.com"   -p 4000:4000   activation-backend
```

### Frontend (`frontend/Dockerfile`)
- `output: 'standalone'` en `next.config.ts`
- **`NEXT_PUBLIC_API_URL` se resuelve en BUILD TIME** — debe pasarse como `--build-arg`

```bash
cd frontend
docker build   --build-arg NEXT_PUBLIC_API_URL=https://api.example.com   -t activation-frontend .
docker run -d -p 3000:3000 activation-frontend
```

### `next.config.ts` — Rewrites
```typescript
// En desarrollo: /api/* → http://localhost:4000/*
// En producción: /api/* → ${NEXT_PUBLIC_API_URL}/*
async rewrites() {
  return [{ source: '/api/:path*', destination: `${apiBaseUrl}/:path*` }]
}
// También permite imágenes de HubSpot: www.avvale.com/hubfs/**
```

---

## Patrones y Convenciones para Cursor

### Añadir un nuevo endpoint backend

1. Crear DTO en `module/dto/nombre.dto.ts` con decoradores `class-validator`
2. Añadir método al servicio (`module/module.service.ts`)
3. Añadir handler al controlador con guards apropiados
4. Si es ADMIN: `@UseGuards(JwtAuthGuard, AdminGuard)`
5. Inyectar usuario: `@CurrentUser() user: UserPayload`
6. Acceder a `user.userId`, `user.email`, `user.role`

### Añadir un nuevo componente frontend

1. Crear directorio: `src/components/NombreComponente/`
2. Crear `NombreComponente.tsx` (con `'use client'` si usa hooks)
3. Crear `NombreComponente.module.css` para estilos
4. Importar con `@/components/NombreComponente/NombreComponente`
5. Usar variables CSS de `tokens.css` para colores y espaciados

### Añadir una nueva página

1. Crear `src/app/(main)/ruta/page.tsx`
2. Añadir `'use client'` si necesita estado/efectos
3. Usar `apiFetch('/api/...')` para llamadas al backend
4. Usar `useUser()` para datos del usuario autenticado
5. Usar `useTheme()` para adaptar estilos al tema actual

### Modificar el schema de Prisma

```bash
# 1. Editar backend/prisma/schema.prisma
# 2. Crear migración:
cd backend && npm run prisma:migrate
# 3. Regenerar cliente:
npx prisma generate
```

### Convenciones de naming

| Tipo | Patrón | Ejemplo |
|------|--------|---------|
| DTO backend | `[Acción][Entidad]Dto` | `CreateActivationDto` |
| Servicio backend | `[Entidad]Service` | `ActivationsService` |
| Controlador | `[Entidad]Controller` | `ActivationsController` |
| Módulo | `[Entidad]Module` | `ActivationsModule` |
| Componente frontend | PascalCase | `DataTable`, `StatusTag` |
| Hook custom | `use[Nombre]` | `useSmoothLoading` |
| Archivo lib | kebab-case | `activation-code.ts` |
| CSS Module clase | camelCase | `styles.tableContainer` |

---

## Gotchas Importantes

1. **`NEXT_PUBLIC_API_URL` es build-time** — en desarrollo siempre vacío; `apiFetch` usa el mismo origen con los rewrites de Next. Cambiar en producción requiere rebuild del frontend.

2. **Rutas espejo intencionales** — `/launcher/activations/...` y `/activations/...` son dos árboles que sirven las mismas páginas con diferente navegación. No es duplicación accidental.

3. **`ownerUserId = null` / `userId = null`** — Areas y EmailTemplates con null son plantillas de sistema; solo ADMIN puede editarlas. Las copias personales tienen el userId del usuario.

4. **Redis es obligatorio** — sin Redis el backend arranca pero los envíos a Make fallan. Siempre ejecutar `npm run redis:dev` en local.

5. **Campo `attachments` en payload Make** — se **elimina** del objeto si el array está vacío. Make trata diferente `campo ausente` vs `[]` en su routing. No cambiar este comportamiento.

6. **Protección de carrera en PENDING_CALLBACK** — `updateMany` con filtro de estado previene sobreescribir `SENT` si el callback de Make llega antes que la actualización del worker.

7. **CORS en producción** — `CORS_ORIGIN` debe listar todos los dominios del frontend. Requests sin header `Origin` (Postman, health checks, callbacks de Make) siempre pasan.

8. **Tema en cookie + BD** — el tema se guarda en `user.appearance` (BD) y en cookie para SSR. El atributo `data-appearance` en `<html>` es lo que activa los tokens CSS.

9. **Sin infraestructura de tests** — no hay tests unitarios ni e2e. No añadir configuración de Jest/Vitest salvo instrucción explícita.

10. **Errores de BullMQ** — usar `UnrecoverableError` (importado de `bullmq`) para errores terminales que no deben reintentarse (ej: estado inválido). Lanzar `Error` normal para errores recuperables que BullMQ reintentará.

11. **Subir adjuntos** — usar `apiUpload()` (no `apiFetch`) para obtener progreso de carga vía `onProgress` callback.

12. **Bootstrap de usuario** — `POST /api/user-config/bootstrap` se llama automáticamente al montar el layout principal. Clona plantillas y firma de sistema al usuario si es la primera vez.

---

## Referencia Rápida de Archivos Clave

| Archivo | Propósito |
|---------|-----------|
| `backend/src/main.ts` | Bootstrap NestJS, ValidationPipe global, CORS |
| `backend/src/app.module.ts` | Registro de todos los módulos |
| `backend/prisma/schema.prisma` | Schema completo de la BD |
| `backend/src/make/make-webhook-payload.ts` | Construcción del payload v4 a Make |
| `backend/src/queue/bullmq.config.ts` | Config Redis y opciones de cola |
| `frontend/src/lib/api.ts` | `apiFetch`, `apiUpload`, `getToken` |
| `frontend/src/lib/replace-template-variables.ts` | Reemplazo de shortcodes en email |
| `frontend/src/app/(main)/layout.tsx` | Autenticación, tema, AppShell |
| `frontend/src/types/activation.ts` | Tipo `Activation` y constantes de estado |
| `frontend/src/styles/tokens.css` | Variables CSS tema Microsoft |
| `frontend/src/styles/tokens-fiori.css` | Variables CSS tema SAP Fiori |
| `frontend/next.config.ts` | Rewrites `/api/*`, imágenes remotas, standalone |
| `.env.example` | Plantilla de todas las variables de entorno |
| `scripts/prepare-env.sh` | Propaga `.env` raíz a backend y frontend |
| `docs/MAKE.md` | Especificación completa de la integración Make |
| `docs/ACTIVATION_STATE_MACHINE.md` | Máquina de estados y BullMQ |
