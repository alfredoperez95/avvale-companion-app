# CLAUDE.md — Avvale Companion App

This file provides guidance for AI assistants working on this codebase.

---

## Project Overview

**Avvale Companion App** is a web platform for managing email activations (business project activation emails) with asynchronous delivery orchestrated via Make.com (formerly Integromat). It is a monorepo with a **NestJS 10** backend and a **Next.js 15** frontend.

**Primary language:** Spanish (UI labels, comments, log messages, and internal naming are in Spanish).

---

## Repository Structure

```
/
├── backend/           # NestJS API (port 4000)
├── frontend/          # Next.js app (port 3000)
├── docs/              # Additional documentation
│   ├── MAKE.md                      # Make.com webhook/callback details, payload schema v4
│   ├── ACTIVATION_STATE_MACHINE.md  # State machine, BullMQ, watchdog
│   └── VERIFICACION.md              # Manual verification steps
├── scripts/
│   └── prepare-env.sh   # Propagates root .env → backend/.env and frontend/.env
├── .env.example         # Single source of truth for env vars
└── Dockerfile           # Root-level (not used in standard Node flow)
```

---

## Tech Stack

### Backend (`backend/`)

| Layer | Technology |
|-------|-----------|
| Framework | NestJS 10 |
| ORM | Prisma 6 (MySQL/MariaDB) |
| Auth | JWT (passport-jwt), bcrypt |
| Queue | BullMQ over Redis (ioredis) |
| Validation | class-validator + class-transformer (global `ValidationPipe`) |
| Runtime | Node.js 22+ |

### Frontend (`frontend/`)

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, React 19) |
| UI Components | SAP UI5 Web Components (`@ui5/webcomponents`) |
| Icons | Fluent UI icons (`@fluentui/react-icons`) |
| Rich Text Editor | TipTap 3 |
| Sanitization | DOMPurify |
| Styling | CSS Modules + custom CSS tokens (Microsoft and SAP Fiori themes) |
| Language | TypeScript 5.7 |

---

## Development Setup

### Prerequisites

- Node.js 22+, npm
- MySQL or MariaDB
- Redis (required for BullMQ queue)
- Docker (optional, for local Redis/MariaDB)

### Quick Start

```bash
# 1. Configure environment (single source of truth)
cp .env.example .env
# Edit .env with DATABASE_URL, JWT_SECRET, REDIS_URL, MAKE_*, etc.
./scripts/prepare-env.sh   # copies to backend/.env and frontend/.env

# 2. Start Redis (Docker)
cd backend && npm run redis:dev

# 3. Install and run backend
cd backend
npm install
npx prisma migrate deploy
npx prisma generate
npm run start:dev          # → http://localhost:4000

# 4. Install and run frontend (new terminal)
cd frontend
npm install
npm run dev                # → http://localhost:3000

# 5. Register first user
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"secret","name":"Your Name"}'
```

### Scripts Reference

| Location | Command | Purpose |
|----------|---------|---------|
| `backend/` | `npm run start:dev` | Hot-reload dev server |
| `backend/` | `npm run build` | Production build (`nest build`) |
| `backend/` | `npm run redis:dev` / `redis:dev:down` | Start/stop local Redis via Docker Compose |
| `backend/` | `npm run prisma:migrate` | Create & run new migration (`migrate dev`) |
| `backend/` | `npm run prisma:studio` | Open Prisma Studio UI |
| `backend/` | `npm run reset:activations` | Wipe all activations + reset auto-increment |
| `backend/` | `npm run import:cc-contacts` | Import CC contacts from script |
| `frontend/` | `npm run dev` | Next.js dev server |
| `frontend/` | `npm run build` | Next.js production build |
| `frontend/` | `npm run lint` | ESLint check |

---

## Backend Architecture (`backend/src/`)

### Module Layout

```
src/
├── app.module.ts              # Root module (registers all modules)
├── main.ts                    # Bootstrap: global pipes, CORS, port
├── health.controller.ts       # GET /api/health
├── prisma/                    # PrismaModule + PrismaService (singleton)
├── auth/                      # JWT auth, register, login, /me CRUD, avatar
│   ├── guards/                # JwtAuthGuard
│   ├── decorators/            # @CurrentUser(), UserPayload type
│   └── strategies/            # passport-jwt strategy
├── activations/               # Core domain: CRUD + send orchestration
│   ├── activations.controller.ts
│   ├── activations.service.ts
│   ├── activation-lookup.service.ts
│   ├── activation-send.orchestrator.ts  # Calls Make, handles state transitions
│   ├── activation-code.ts
│   ├── email-html.util.ts
│   └── dto/
├── areas/                     # Areas & sub-areas catalog
├── attachments/               # File upload/download, public token URLs
├── make/                      # MakeService (outbound webhook), callback controller
│   ├── make.service.ts
│   ├── make-webhook-payload.ts   # Builds payload schema v4
│   └── make-callback.controller.ts  # POST /api/webhooks/make/callback
├── queue/                     # BullMQ setup, job producers, processors
│   ├── bullmq.config.ts
│   ├── queue.module.ts
│   ├── queue.constants.ts
│   ├── processors/
│   └── producers/
├── contacts/                  # SubAreaContacts (JP contacts)
├── billing-admin-contacts/    # BillingAdminContact management
├── email-signature/           # Per-user HTML email signature
├── email-templates/           # User & system email templates
├── user-config/               # Bootstrap user preferences
├── users/                     # Admin-only user management
└── config/                    # Config helpers (e.g., backend-public-base-url.ts)
```

### Key Conventions

- **Global API prefix:** `/api` (all routes under `http://localhost:4000/api`)
- **Auth:** All protected routes use `@UseGuards(JwtAuthGuard)`. Inject the current user via `@CurrentUser() user: UserPayload`.
- **Roles:** `USER` (default) and `ADMIN`. Check `user.role === 'ADMIN'` in service/controller logic.
- **Validation:** All DTOs use `class-validator` decorators. The global `ValidationPipe` has `whitelist: true` and `forbidNonWhitelisted: true`.
- **Database naming:** Prisma models use camelCase in code, `snake_case` mapped to DB (`@map("column_name")`, `@@map("table_name")`).
- **UUIDs everywhere:** All primary keys are `String @id @default(uuid())`.
- **Logger:** Use NestJS `Logger` — `private readonly logger = new Logger(ClassName.name)`.
- **No test files exist currently** — do not generate test boilerplate unless asked.

### Activation State Machine

States: `DRAFT` → `QUEUED` → `PROCESSING` → `PENDING_CALLBACK` → `SENT` | `FAILED`

Also: `RETRYING` (BullMQ retry), `FAILED` (final).

Full transition table: see `docs/ACTIVATION_STATE_MACHINE.md`.

---

## Frontend Architecture (`frontend/src/`)

### Directory Layout

```
src/
├── app/
│   ├── layout.tsx              # Root layout (fonts, globals.css)
│   ├── login/                  # Public login page
│   └── (main)/                 # Auth-gated route group
│       ├── layout.tsx          # Fetches /api/auth/me, sets theme, renders AppShell
│       ├── launcher/           # App Launcher + nested activations routes
│       │   └── activations/    # Dashboard, list, new, edit, detail, configuration
│       ├── activations/        # Direct activation routes (mirrors launcher routes)
│       ├── admin/              # Admin: user management (ADMIN only)
│       ├── profile/ & perfil/  # User profile pages
│       ├── configuration/      # Areas, contacts, email templates, billing, signature
│       └── demo/icons/         # Icon showcase
├── components/
│   ├── AppShell/               # Shell with Microsoft or Fiori navigation
│   ├── AttachmentGrid/
│   ├── ConfirmDialog/
│   ├── DataTable/
│   ├── DetailDrawer/
│   ├── FilterBar/
│   ├── Footer/
│   ├── Icon/
│   ├── KpiCard/
│   ├── LoadingScreen/
│   ├── OfferCodeTableCell/
│   ├── PhoneCountryPicker/
│   ├── RichTextEditor/         # TipTap-based HTML editor
│   └── StatusTag/
├── contexts/
│   ├── ThemeContext.tsx         # Theme: 'microsoft' | 'fiori'
│   └── UserContext.tsx          # Authenticated user data
├── hooks/
│   ├── useAvatarUrl.ts
│   └── useSmoothLoading.ts
├── lib/
│   ├── api.ts                  # apiFetch(), apiUpload(), getToken()
│   ├── activation-*.ts         # Domain helpers for activations
│   ├── appearance-cookie.ts
│   └── ...
├── styles/
│   ├── tokens.css              # Microsoft theme CSS variables
│   ├── tokens-fiori.css        # SAP Fiori theme CSS variables
│   └── ...
└── types/
    ├── activation.ts
    └── ui5-webcomponents.d.ts
```

### Key Conventions

- **App Router only** — all pages are Server or Client Components (Next.js 15 App Router). No Pages Router.
- **`(main)` route group** — wraps all authenticated pages. The layout fetches `/api/auth/me` and redirects to `/login` on 401.
- **Client Components** — pages that use state/effects must start with `'use client'`.
- **API calls** — always use `apiFetch(path, init?)` from `@/lib/api`. It injects the JWT from `localStorage` and handles base URL resolution.
- **Token storage:** JWT is stored in `localStorage` under the key `'token'`. On logout, clear it and redirect to `/login`.
- **Theming:** Two themes: `microsoft` (default) and `fiori`. Applied via `data-appearance` attribute on `<html>`. Switched via `ThemeContext` and persisted in a cookie. User preference stored in `user.appearance` field.
- **Custom events for state updates:**
  - `theme-changed` — dispatched when theme changes
  - `user-updated` — dispatched when profile is updated
- **UI5 Web Components:** Imported from `@ui5/webcomponents` via side-effect imports (e.g., `import '@ui5/webcomponents/dist/Button.js'`). TypeScript types are provided by `src/types/ui5-webcomponents.d.ts`.
- **CSS Modules:** Component-scoped styles use `ComponentName.module.css` next to the component.
- **No global state management library** — state is managed via React hooks (`useState`, `useEffect`) and React Context.
- **`next.config.ts` rewrites:** In development, `/api/*` is proxied to `http://localhost:4000/*`, so frontend requests go to `/api/...` without CORS issues.
- **Standalone output:** `output: 'standalone'` in `next.config.ts` for Docker deployment.

---

## Environment Variables

Single source: root `.env`, propagated to `backend/.env` and `frontend/.env` by `./scripts/prepare-env.sh`.

| Variable | Used by | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | Backend | MySQL/MariaDB connection string |
| `JWT_SECRET` | Backend | JWT signing key (must be strong in production) |
| `JWT_EXPIRES_IN` | Backend | Token expiry (e.g. `7d`) |
| `CORS_ORIGIN` | Backend | Comma-separated frontend origins |
| `NEXT_PUBLIC_API_URL` | Frontend | Public API URL (build-time for Docker) |
| `BACKEND_PUBLIC_URL` | Backend | Base URL for attachment URLs sent to Make |
| `REDIS_URL` | Backend | BullMQ Redis connection |
| `BULL_PREFIX` | Backend | Redis key prefix (default: `avvale`) |
| `ACTIVATION_SEND_QUEUE_ATTEMPTS` | Backend | BullMQ retry attempts (default: 5) |
| `ACTIVATION_SEND_QUEUE_BACKOFF_MS` | Backend | Exponential backoff base (default: 5000ms) |
| `MAKE_WEBHOOK_URL` | Backend | Make.com Custom Webhook URL |
| `MAKE_WEBHOOK_TIMEOUT_MS` | Backend | Outbound POST timeout (default: 30000ms) |
| `MAKE_WEBHOOK_SECRET` | Backend | Optional `X-Webhook-Secret` header |
| `MAKE_CALLBACK_SECRET` | Backend | Shared secret for Make→backend callback |
| `MAKE_PENDING_CALLBACK_TIMEOUT_MS` | Backend | Watchdog timeout before marking FAILED |
| `ATTACHMENTS_DIR` | Backend | Upload directory (persistent volume in prod) |
| `PORT` | Backend | HTTP port (default: 4000) |

---

## Make.com Integration

- **Outbound:** `MakeService.triggerWebhook()` POSTs payload schema v4 to `MAKE_WEBHOOK_URL`.
- **Inbound callback:** `POST /api/webhooks/make/callback` — Make calls this after processing. Body must include the `MAKE_CALLBACK_SECRET`. Sets status to `SENT` or `FAILED`.
- **Attachments:** Files are given public tokens before sending to Make. URLs expire after callback (`SENT`).
- **Race condition guard:** If Make responds to the webhook and the callback arrives before the `PENDING_CALLBACK` update, `updateMany` with status filter prevents overwriting `SENT`.

Full details: `docs/MAKE.md`.

---

## Database (Prisma)

- **Provider:** MySQL (MariaDB compatible)
- **Schema:** `backend/prisma/schema.prisma`
- **Migrations:** `backend/prisma/migrations/`

### Key Models

| Model | Table | Notes |
|-------|-------|-------|
| `User` | `users` | UUID PK, roles: `USER`/`ADMIN` |
| `Activation` | `activations` | Core domain; `activationNumber` auto-increments |
| `ActivationAttachment` | `activation_attachments` | Files; `publicToken` for Make downloads |
| `Area` / `SubArea` | `areas` / `sub_areas` | `ownerUserId=null` = system template (admin only) |
| `SubAreaContact` | `sub_area_contacts` | JP contacts per sub-area |
| `CcContact` | `cc_contacts` | CC contacts pool |
| `BillingAdminContact` | `billing_admin_contacts` | Billing contacts |
| `EmailTemplate` | `email_templates` | `userId=null` = system template |
| `EmailSignature` | `email_signature` | One per user (HTML content) |

### Prisma Workflow

```bash
# After changing schema.prisma:
cd backend
npm run prisma:migrate   # creates and applies migration
npx prisma generate      # regenerates Prisma Client
```

---

## Docker / Production

- Backend Dockerfile: `backend/Dockerfile` — entrypoint runs `npx prisma migrate deploy` then starts the app.
- Frontend Dockerfile: `frontend/Dockerfile` — `output: 'standalone'`. `NEXT_PUBLIC_API_URL` must be passed as `--build-arg` since it's resolved at build time.

```bash
# Backend
cd backend && docker build -t activation-backend .

# Frontend (pass NEXT_PUBLIC_API_URL at build time)
cd frontend && docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com \
  -t activation-frontend .
```

---

## Important Patterns & Gotchas

1. **`NEXT_PUBLIC_API_URL` is build-time** — changing it requires a frontend rebuild. In development, it is deliberately empty so `apiFetch` uses the same origin with Next.js rewrites.

2. **Parallel route duplication** — routes exist both under `/launcher/activations/...` and at `/activations/...`. These serve the same pages in different shell contexts (Fiori tabs vs. Microsoft sidebar).

3. **User-scoped vs. system resources** — `Area`, `EmailTemplate` with `ownerUserId/userId = null` are system templates editable only by ADMIN. User copies have the userId set.

4. **BullMQ requires Redis** — without Redis the backend starts but activation sends will fail. Always run `npm run redis:dev` locally.

5. **Empty `attachments` field** — when there are no attachments, the field is deleted from the Make payload (not sent as `[]`), because Make treats missing fields and empty arrays differently in routing.

6. **CORS in production** — `CORS_ORIGIN` must list all frontend origins. Requests without `Origin` header (Postman, health checks) are always allowed.

7. **Theme persistence** — theme is stored both in the DB (`user.appearance`) and in a cookie for SSR. The `data-appearance` HTML attribute drives CSS variable selection between Microsoft and Fiori tokens.

8. **No testing infrastructure** — there are currently no unit or integration tests. Do not add test configuration without explicit instruction.
