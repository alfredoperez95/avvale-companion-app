# KYC (Client Knowledge) en Avvale Companion

El módulo **KYC** está integrado de forma **nativa** en Avvale Companion:

- **Backend**: [`backend/src/kyc/`](../backend/src/kyc/) expone `GET/POST/...` bajo `/kyc/*` (el cliente usa `/api/kyc/...` y Next reescribe a Nest). Autenticación: **JWT de Companion** (cualquier usuario autenticado).
- **Base de datos**: tablas con prefijo `kyc_*` en el **mismo MySQL** del proyecto, vía [Prisma](../backend/prisma/schema.prisma) y migraciones.
- **IA (chat)**: se usa la **API de Anthropic** con la clave que cada usuario guarda en **Perfil → credenciales de IA** (`UserAnthropicCredential`); el modelo del chat se configura con `KYC_CHAT_MODEL` (por defecto en código: `sonnet`).
- **Interfaz**: la pantalla vive en el launcher de Next (React) en [`/launcher/kyc`](../frontend/src/app/(main)/launcher/kyc/); un informe PDF/impresión puede seguir disponible en recursos estáticos si se mantiene [`frontend/public/kyc/report.html`](../frontend/public/kyc/report.html).

No hace falta levantar ningún servicio HTTP adicional (puerto 3388 u otro) para el flujo normal del producto.

## 1. Requisitos

1. Migraciones Prisma aplicadas (tablas `kyc_*`). Desde `backend/`:

   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

2. Usuario autenticado en Companion.
3. Clave **Anthropic** configurada en Perfil para el chat KYC (por usuario).
4. En el **backend** (`.env` opcional):

   | Variable | Descripción |
   |----------|-------------|
   | `KYC_CHAT_MODEL` | `haiku`, `sonnet` u `opus`. Si se omite, aplica el valor por defecto del código (`sonnet`). |

## 2. Uso en la aplicación

- **App Launcher**: mosaico KYC (reordenable con el resto de herramientas) o ruta directa [`/launcher/kyc`](../frontend/src/app/(main)/launcher/kyc/page.tsx).
- Se llama a la API en `/api/kyc/...` (mismo patrón que el resto de módulos).

### Datos dummy para testing (Organigrama)

En el panel **Organigrama**, existe el botón **“+ Dummies”** para crear perfiles inventados con tipologías variadas y poder testear drag & drop, relaciones y edición.

## 3. Arquitectura (referencia)

- Controlador y servicio: [backend/src/kyc/README.md](../backend/src/kyc/README.md)
- Esquema: [backend/prisma/schema.prisma](../backend/prisma/schema.prisma) (modelos `Kyc*`)

## 4. Extensión ↔ KYC

La **extensión Chrome** (proyecto aparte, p. ej. `avvale-companion-extension`) envía perfiles LinkedIn al organigrama KYC usando el **mismo JWT** que la app (login Companion → token; en la extensión suele guardarse en `chrome.storage.local` y enviarse como `Authorization: Bearer …` desde el service worker).

### Rutas y proxy

- **Nest** expone KYC en **`/kyc/*`** (sin prefijo `api`).
- La **web** llama **`/api/kyc/*`**; Next reescribe a Nest (`frontend/next.config.ts`).
- La extensión suele usar una base tipo **`https://<host>/api`** para auth (`/api/auth/login`, …) y derivar la raíz HTTP para KYC **quitando el sufijo `/api`**, p. ej. `GET https://<host>/kyc/clients`. En el front desplegado existe también rewrite **`/kyc/:path*`** → backend, para que esas URLs en el **mismo origen** que la app lleguen a Nest (no devuelvan 404 de Next).

### Endpoints dedicados extensión

| Método | Ruta (Nest / mismo host) | Uso |
|--------|--------------------------|-----|
| `GET` | `/kyc/clients?q=` opcional | Lista `{ clients: [{ id, name }] }` (empresas con perfil KYC activo). |
| `POST` | `/kyc/linkedin-profile` | Alta miembro + contacto; cuerpo validado (`source`, `clientId`, `name`, `role`, `level`, URLs LinkedIn, opcionales de captura). **201** `{ orgMemberId, contactId }`. Errores típicos: **400** (perfil inactivo, exclusión partner/competencia, nivel desconocido), **404**, **409** (dedupe por URL LinkedIn normalizada). |

Implementación: [`backend/src/kyc/kyc.controller.ts`](../backend/src/kyc/kyc.controller.ts), [`kyc.service.ts`](../backend/src/kyc/kyc.service.ts), DTO [`dto/kyc-linkedin-profile.dto.ts`](../backend/src/kyc/dto/kyc-linkedin-profile.dto.ts). Normalización / niveles / filtro organigrama: utilidades en `backend/src/kyc/kyc-linkedin-extension.util.ts` y `kyc-org-chart-eligibility.util.ts` (paridad con el filtro del front).

### Otros enlaces extensión ↔ web

- Descargas y sesión en pestaña Companion: [BROWSER_EXTENSION_BRIDGE.md](./BROWSER_EXTENSION_BRIDGE.md) (distinto contrato; no sustituye a los endpoints KYC anteriores).

