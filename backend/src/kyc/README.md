# Módulo KYC (Client Knowledge)

## Enfoque (nativo Companion)

- **API HTTP** en Nest: [`KycController`](kyc.controller.ts) bajo `/kyc/*`. El front llama a `/api/kyc/...` (Next reescribe al backend sin el prefijo `/api` hacia el mismo path que Nest, según [next.config.ts](../../frontend/next.config.ts)).
- **Autorización**: `JwtAuthGuard` + `AdminGuard` (solo **ADMIN**).
- **Datos**: [`KycService`](kyc.service.ts) usa **Prisma** y las tablas `kyc_*` en **MySQL** (mismo `DATABASE_URL` que el resto de la app). No hay proxy ni `KYC_UPSTREAM_URL`.
- **Anthropic (chat)**: el streaming del chat lee la clave del **usuario** en `UserAnthropicCredential` vía [`AnthropicCredentialsService`](../ai-credentials/anthropic/anthropic-credentials.service.ts). Modelo configurable con `KYC_CHAT_MODEL` (ver [`kyc.config.ts`](kyc.config.ts)).

## Archivos clave

| Archivo | Rol |
|---------|-----|
| `kyc.module.ts` | Módulo Nest: Prisma, credenciales IA, cliente Anthropic (Yubiq) |
| `kyc.controller.ts` | Rutas REST (empresas, perfil, organigrama, señales, open questions, chat) |
| `kyc.service.ts` | Lógica y `streamChat` (SSE) |
| `kyc-mappers.ts` | Serialización a formato esperado por la UI (nombres tipo snake_case donde aplica) |
| `kyc-apply-proposed.util.ts` | Aplica sugerencias estructuradas (`KYC_PROPOSED_JSON`) al perfil |
| `kyc-prompts.ts` | Prompts de entrevista / investigación para el asistente |

## Frontend

- Pantalla principal: [`../../frontend/src/app/(main)/launcher/kyc/`](../../frontend/src/app/(main)/launcher/kyc/) (componente React).
- Puede quedar material estático auxiliar bajo `frontend/public/kyc/` (p. ej. informe de impresión).

## Documentación de producto

[docs/KYC.md](../../docs/KYC.md)

## Stack legado (no requerido)

El directorio `services/kyc/` en el monorepo conserva un prototipo Node+Postgres; **el producto no depende de él**. No configurar `KYC_UPSTREAM_URL` ni contenedor en el puerto 3388 para el flujo de Companion.
