# KYC (Client Knowledge) en Avvale Companion

El módulo **KYC** está integrado de forma **nativa** en Avvale Companion:

- **Backend**: [`backend/src/kyc/`](../backend/src/kyc/) expone `GET/POST/...` bajo `/kyc/*` (el cliente usa `/api/kyc/...` y Next reescribe a Nest). Autenticación: **JWT de Companion** y rol **ADMIN**.
- **Base de datos**: tablas con prefijo `kyc_*` en el **mismo MySQL** del proyecto, vía [Prisma](../backend/prisma/schema.prisma) y migraciones.
- **IA (chat)**: se usa la **API de Anthropic** con la clave que el administrador guarda en **Perfil → credenciales de IA** (`UserAnthropicCredential`); el modelo del chat se configura con `KYC_CHAT_MODEL` (por defecto en código: `sonnet`).
- **Interfaz**: la pantalla vive en el launcher de Next (React) en [`/launcher/kyc`](../frontend/src/app/(main)/launcher/kyc/); un informe PDF/impresión puede seguir disponible en recursos estáticos si se mantiene [`frontend/public/kyc/report.html`](../frontend/public/kyc/report.html).

No hace falta levantar ningún servicio HTTP adicional (puerto 3388 u otro) para el flujo normal del producto.

## 1. Requisitos

1. Migraciones Prisma aplicadas (tablas `kyc_*`). Desde `backend/`:

   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

2. Usuario con rol **ADMIN** en Companion.
3. Clave **Anthropic** configurada en Perfil para el chat KYC.
4. En el **backend** (`.env` opcional):

   | Variable | Descripción |
   |----------|-------------|
   | `KYC_CHAT_MODEL` | `haiku`, `sonnet` u `opus`. Si se omite, aplica el valor por defecto del código (`sonnet`). |

## 2. Uso en la aplicación

- **App Launcher**: mosaico KYC o ruta directa [`/launcher/kyc`](../frontend/src/app/(main)/launcher/kyc/page.tsx) (solo ADMIN).
- Se llama a la API en `/api/kyc/...` (mismo patrón que el resto de módulos).

### Datos dummy para testing (Organigrama)

En el panel **Organigrama**, existe el botón **“+ Dummies”** para crear perfiles inventados con tipologías variadas y poder testear drag & drop, relaciones y edición.

## 3. Arquitectura (referencia)

- Controlador y servicio: [backend/src/kyc/README.md](../backend/src/kyc/README.md)
- Esquema: [backend/prisma/schema.prisma](../backend/prisma/schema.prisma) (modelos `Kyc*`)

## 4. Stack legado (solo referencia)

Existe bajo [`services/kyc/`](../services/kyc/) un slice histórico Node+PostgreSQL usado en prototipos anteriores. **No es obligatorio** para Companion; el producto no depende de él. Ver [services/kyc/README.md](../services/kyc/README.md).
