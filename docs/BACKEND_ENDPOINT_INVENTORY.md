# Inventario de endpoints backend

Fecha: 2026-07-18

Actualizado: 2026-07-21 (auth fail-closed, hardening de adjuntos, límites destructivos y permisos KYC/Activations).

Alcance: backend NestJS en `backend/`. No hay prefijo global en Nest; el frontend reescribe `/api/*` hacia estas rutas.

## Resumen de arquitectura

| Elemento | Estado |
| --- | --- |
| Entry point | `backend/src/main.ts` |
| Módulo raíz | `backend/src/app.module.ts` |
| Base de datos | MySQL vía Prisma (`backend/prisma/schema.prisma`) |
| Auth principal | JWT Bearer (`Authorization: Bearer ...`) |
| Guard global | `JwtAuthGuard` + `ThrottlerGuard` |
| Guard JWT | Fail-closed global; excepciones explícitas con `@Public()` |
| Swagger/OpenAPI | No encontrado |
| Filtro global de errores | No encontrado |
| Validación global | `ValidationPipe` con `whitelist`, `forbidNonWhitelisted`, `forbidUnknownValues`, `transform`, sin conversión implícita |
| CORS | Allowlist exacta por `CORS_ORIGIN`; `credentials: true` |
| Trust proxy | `TRUST_PROXY_HOPS` o `loopback` |

## Módulos NestJS

| Módulo | Ruta |
| --- | --- |
| `AppModule` | `backend/src/app.module.ts` |
| `QueueModule` | `backend/src/queue/queue.module.ts` |
| `PrismaModule` | `backend/src/prisma/prisma.module.ts` |
| `HealthModule` | `backend/src/health/health.module.ts` |
| `AuthModule` | `backend/src/auth/auth.module.ts` |
| `UsersModule` | `backend/src/users/users.module.ts` |
| `InvitationsModule` | `backend/src/invitations/invitations.module.ts` |
| `ActivationsModule` | `backend/src/activations/activations.module.ts` |
| `AreasModule` | `backend/src/areas/areas.module.ts` |
| `ContactsModule` | `backend/src/contacts/contacts.module.ts` |
| `BillingAdminContactsModule` | `backend/src/billing-admin-contacts/billing-admin-contacts.module.ts` |
| `EmailTemplatesModule` | `backend/src/email-templates/email-templates.module.ts` |
| `EmailSignatureModule` | `backend/src/email-signature/email-signature.module.ts` |
| `UserConfigModule` | `backend/src/user-config/user-config.module.ts` |
| `AiCredentialsModule` | `backend/src/ai-credentials/ai-credentials.module.ts` |
| `YubiqModule` | `backend/src/yubiq/yubiq.module.ts` |
| `RfqAnalysisModule` | `backend/src/rfq-analysis/rfq-analysis.module.ts` |
| `MeddpiccModule` | `backend/src/meddpicc/meddpicc.module.ts` |
| `KycModule` | `backend/src/kyc/kyc.module.ts` |
| `ExpensesModule` | `backend/src/expenses/expenses.module.ts` |
| `AttachmentsModule` | `backend/src/attachments/attachments.module.ts` |
| `MakeModule` | `backend/src/make/make.module.ts` |
| `MailModule` | `backend/src/mail/mail.module.ts` |

## Inventario de endpoints

| Método | Ruta | Controller | Autenticación | Rol/permiso | DTO | Rate limit | Riesgo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| POST | `/auth/register` | `AuthController` | Pública | Ninguno | Ninguno | 10/min | Público; deshabilitado (`410 Gone`) |
| POST | `/auth/login` | `AuthController` | Pública | Ninguno | `LoginDto` | 10/min | Público, autenticación, fuerza bruta |
| POST | `/auth/magic-link/request` | `AuthController` | Pública | Ninguno | `MagicLinkRequestDto` | 5/min | Público, autenticación, abuso de recursos |
| POST | `/auth/magic-link/verify` | `AuthController` | Pública | Ninguno | `MagicLinkVerifyDto` | 15/min | Público, autenticación, token temporal |
| GET | `/auth/invitations/preview?token=` | `AuthController` | Pública | Token invitación | Query `token` sin DTO | 30/min | Público, token temporal |
| POST | `/auth/invitations/accept` | `AuthController` | Pública | Token invitación | `AcceptInvitationDto` | 10/min | Público, modificación de datos |
| GET | `/auth/branding` | `AuthController` | Pública | Ninguno | Ninguno | 60/min | Público |
| GET | `/auth/me` | `AuthController` | JWT | Usuario habilitado | Ninguno | Global | Datos sensibles |
| PATCH | `/auth/me` | `AuthController` | JWT | Propietario | `UpdateProfileDto` | Global | Modificación de datos |
| POST | `/auth/me/avatar` | `AuthController` | JWT | Propietario | Upload `file` | Global | Upload, modificación de datos |
| GET | `/auth/me/avatar` | `AuthController` | JWT | Propietario | Ninguno | Global | Datos sensibles, descarga |
| DELETE | `/auth/me/avatar` | `AuthController` | JWT | Propietario | Ninguno | Global | Eliminación de datos |
| GET | `/users` | `UsersController` | JWT + Admin | `ADMIN` | Ninguno | 20/min | Operación administrativa, datos sensibles |
| POST | `/users` | `UsersController` | JWT + Admin | `ADMIN` | `CreateUserDto` | 20/min | Operación administrativa, modificación de datos |
| POST | `/users/invite` | `UsersController` | JWT + Admin | `ADMIN` | `InviteUserDto` | 20/min | Operación administrativa, integración externa SMTP |
| PATCH | `/users/:id` | `UsersController` | JWT + Admin | `ADMIN` | `UpdateUserDto`; param `id` | 20/min | Operación administrativa, modificación de datos, posible IDOR si falta scope admin |
| DELETE | `/users/:id` | `UsersController` | JWT + Admin | `ADMIN` | Param `id` | 20/min | Operación administrativa, eliminación de datos |
| GET | `/invitations` | `InvitationsController` | JWT + Admin | `ADMIN` | Ninguno | Global | Operación administrativa |
| DELETE | `/invitations/:id` | `InvitationsController` | JWT + Admin | `ADMIN` | Param `id` | Global | Operación administrativa, eliminación |
| POST | `/invitations/:id/resend` | `InvitationsController` | JWT + Admin | `ADMIN` | Param `id` | Global | Operación administrativa, integración SMTP |
| POST | `/activations` | `ActivationsController` | JWT | Usuario | `CreateActivationDto` | Global | Modificación de datos |
| GET | `/activations?status=` | `ActivationsController` | JWT | Usuario; `ADMIN` ve todo | Query `status` sin DTO | Global | Datos sensibles, posible abuso por listado sin paginación |
| GET | `/activations/:id/attachments` | `ActivationsController` | JWT | Propietario; admin en servicio parcial | Param `id` | Global | Datos sensibles, posible IDOR |
| POST | `/activations/:id/attachments/upload` | `ActivationsController` | JWT | Propietario | Param `id`; upload `file`; body `originalUrl` | Global | Upload, modificación de datos |
| POST | `/activations/:id/attachments/import-scanned-urls` | `ActivationsController` | JWT | Propietario | Param `id` | Global | SSRF, integración externa, abuso de recursos |
| GET | `/activations/:id/attachments/:attachmentId` | `ActivationsController` | JWT | Propietario | Params `id`, `attachmentId` | Global | Descarga, datos sensibles, posible IDOR |
| DELETE | `/activations/:id/attachments/:attachmentId` | `ActivationsController` | JWT | Propietario | Params `id`, `attachmentId` | Global | Eliminación de datos |
| GET | `/activations/project-jp-preview` | `ActivationsController` | JWT | Usuario | Query `areaIds`, `subAreaIds`, contactos | Global | Datos internos |
| GET | `/activations/:id` | `ActivationsController` | JWT | Propietario; `ADMIN` ve todo | Param `id` | Global | Datos sensibles, posible IDOR |
| POST | `/activations/:id/send` | `ActivationsController` | JWT | Propietario | Param `id` | Global | Integración externa Make/SMTP, abuso de recursos |
| PATCH | `/activations/:id` | `ActivationsController` | JWT | Propietario | `UpdateActivationDto`; param `id` | Global | Modificación de datos, posible IDOR |
| DELETE | `/activations/:id` | `ActivationsController` | JWT | Propietario o `ADMIN` | Param `id` | Global | Eliminación de datos; admin puede borrar activaciones ajenas |
| GET | `/areas` | `AreasController` | JWT | Usuario; detalles admin restringidos por servicio | Query `admin`, `withSubareas` sin DTO | Global | Datos internos |
| POST | `/areas` | `AreasController` | JWT + Admin | `ADMIN` | `CreateAreaDto` | Global | Operación administrativa, modificación |
| GET | `/areas/subareas/:subAreaId/contacts` | `AreasController` | JWT + Admin | `ADMIN` | Param `subAreaId` | Global | Operación administrativa, datos personales |
| GET | `/areas/subareas/by-contact-email?email=` | `AreasController` | JWT | Usuario | Query `email` sin DTO | Global | Datos internos, posible enumeración |
| POST | `/areas/subareas/:subAreaId/contacts` | `AreasController` | JWT + Admin | `ADMIN` | `CreateSubAreaContactDto`; param | Global | Operación administrativa, modificación |
| PATCH | `/areas/subareas/contacts/:contactId` | `AreasController` | JWT + Admin | `ADMIN` | `UpdateSubAreaContactDto`; param | Global | Operación administrativa, modificación |
| DELETE | `/areas/subareas/contacts/:contactId` | `AreasController` | JWT + Admin | `ADMIN` | Param `contactId` | Global | Operación administrativa, eliminación |
| PATCH | `/areas/subareas/:subAreaId` | `AreasController` | JWT + Admin | `ADMIN` | `UpdateSubAreaDto`; param | Global | Operación administrativa, modificación |
| DELETE | `/areas/subareas/:subAreaId` | `AreasController` | JWT + Admin | `ADMIN` | Param `subAreaId` | Global | Operación administrativa, eliminación |
| GET | `/areas/:id/subareas` | `AreasController` | JWT + Admin | `ADMIN` | Param `id` | Global | Operación administrativa |
| POST | `/areas/:id/subareas` | `AreasController` | JWT + Admin | `ADMIN` | `CreateSubAreaDto`; param | Global | Operación administrativa, modificación |
| PATCH | `/areas/:id` | `AreasController` | JWT + Admin | `ADMIN` | `UpdateAreaDto`; param | Global | Operación administrativa, modificación |
| DELETE | `/areas/:id` | `AreasController` | JWT + Admin | `ADMIN` | Param `id` | Global | Operación administrativa, eliminación |
| GET | `/contacts` | `ContactsController` | JWT | Usuario | Ninguno | Global | Datos internos/personales |
| POST | `/contacts` | `ContactsController` | JWT + Admin | `ADMIN` | `CreateCcContactDto` | Global | Operación administrativa, modificación |
| PATCH | `/contacts/:id` | `ContactsController` | JWT + Admin | `ADMIN` | `UpdateCcContactDto`; param `id` | Global | Operación administrativa, modificación |
| DELETE | `/contacts/:id` | `ContactsController` | JWT + Admin | `ADMIN` | Param `id` | Global | Operación administrativa, eliminación |
| GET | `/billing-admin-contacts` | `BillingAdminContactsController` | JWT | Usuario | Ninguno | Global | Datos internos/personales |
| POST | `/billing-admin-contacts` | `BillingAdminContactsController` | JWT + Admin | `ADMIN` | `CreateBillingAdminContactDto` | Global | Operación administrativa, modificación |
| PATCH | `/billing-admin-contacts/:id` | `BillingAdminContactsController` | JWT + Admin | `ADMIN` | `UpdateBillingAdminContactDto`; param | Global | Operación administrativa, modificación |
| DELETE | `/billing-admin-contacts/:id` | `BillingAdminContactsController` | JWT + Admin | `ADMIN` | Param `id` | Global | Operación administrativa, eliminación |
| GET | `/email-templates` | `EmailTemplatesController` | JWT | Usuario; admin en servicio | Ninguno | Global | Datos de usuario |
| POST | `/email-templates/restore-from-system` | `EmailTemplatesController` | JWT | Usuario | Ninguno | Global | Modificación de datos |
| POST | `/email-templates` | `EmailTemplatesController` | JWT | Usuario | `CreateEmailTemplateDto` | Global | Modificación de datos |
| PATCH | `/email-templates/:id` | `EmailTemplatesController` | JWT | Propietario/admin | `UpdateEmailTemplateDto`; param | Global | Modificación, posible IDOR |
| DELETE | `/email-templates/:id` | `EmailTemplatesController` | JWT | Propietario/admin | Param `id` | Global | Eliminación, posible IDOR |
| GET | `/email-signature` | `EmailSignatureController` | JWT | Usuario | Ninguno | Global | Datos de usuario |
| PUT | `/email-signature` | `EmailSignatureController` | JWT | Usuario | `UpsertEmailSignatureDto` | Global | Modificación de datos |
| POST | `/user-config/bootstrap` | `UserConfigController` | JWT | Usuario | Ninguno | Global | Preferencias usuario |
| GET | `/user/ai-credentials/anthropic` | `AnthropicCredentialsController` | JWT | Usuario | Ninguno | Global | Datos sensibles (estado de credencial) |
| POST | `/user/ai-credentials/anthropic` | `AnthropicCredentialsController` | JWT | Usuario | `SaveAnthropicCredentialDto` | Global | Secreto/API key, modificación |
| POST | `/user/ai-credentials/anthropic/test` | `AnthropicCredentialsController` | JWT | Usuario | `SaveAnthropicCredentialDto` | Global | Integración externa, abuso de recursos |
| DELETE | `/user/ai-credentials/anthropic` | `AnthropicCredentialsController` | JWT | Usuario | Ninguno | Global | Eliminación de secreto |
| POST | `/yubiq/approve-seal-filler/analyze` | `ApproveSealFillerController` | JWT | Usuario | Upload `file`; body `model` sin DTO | Global | Upload, IA, abuso de recursos |
| POST | `/yubiq/approve-seal-filler/translate` | `ApproveSealFillerController` | JWT | Usuario | Body sin DTO estricto | Global | IA, abuso de recursos |
| GET | `/rfq-analyses` | `RfqAnalysisController` | JWT | Usuario | Query `page`, `pageSize`, `kycCompanyId` sin DTO | Global | Datos sensibles, paginación |
| POST | `/rfq-analyses` | `RfqAnalysisController` | JWT | Usuario | `CreateRfqAnalysisDto` | Global | Modificación, IA |
| GET | `/rfq-analyses/:id` | `RfqAnalysisController` | JWT | Propietario | Param `id` | Global | Datos sensibles, posible IDOR |
| DELETE | `/rfq-analyses/:id` | `RfqAnalysisController` | JWT | Propietario | Param `id` | Global | Eliminación |
| POST | `/rfq-analyses/:id/sources` | `RfqAnalysisController` | JWT | Propietario | Upload `files` | Global | Upload, IA, abuso de recursos |
| POST | `/rfq-analyses/:id/process` | `RfqAnalysisController` | JWT | Propietario | Param `id` | Global | IA, operación costosa |
| PATCH | `/rfq-analyses/:id/recommended-questions` | `RfqAnalysisController` | JWT | Propietario | `PatchRfqRecommendedQuestionsDto` | Global | Modificación |
| POST | `/rfq-analyses/:id/messages` | `RfqAnalysisController` | JWT | Propietario | `PostRfqMessageDto` | Global | IA, abuso de recursos |
| POST | `/webhooks/rfq-email/inbound` | `RfqEmailWebhookController` | Pública + secreto | `RFQ_EMAIL_WEBHOOK_SECRET` | Body webhook flexible | 60/min | Público, webhook, upload base64, IA |
| GET | `/meddpicc/deals` | `MeddpiccController` | JWT | Usuario/admin según servicio | Query `status`, `userId` sin DTO | Global | Datos sensibles |
| GET | `/meddpicc/deals/stats` | `MeddpiccController` | JWT | Usuario/admin según servicio | Ninguno | Global | Datos agregados |
| POST | `/meddpicc/deals` | `MeddpiccController` | JWT | Usuario | `CreateMeddpiccDealDto` | Global | Modificación |
| POST | `/meddpicc/deals/:id/attachments` | `MeddpiccController` | JWT | Propietario | Upload `files` | Global | Upload |
| DELETE | `/meddpicc/deals/:id/attachments/:attachmentId` | `MeddpiccController` | JWT | Propietario | Params | Global | Eliminación, posible IDOR |
| GET | `/meddpicc/deals/:id` | `MeddpiccController` | JWT | Propietario/admin | Param `id` | Global | Datos sensibles |
| PATCH | `/meddpicc/deals/:id` | `MeddpiccController` | JWT | Propietario/admin | `UpdateMeddpiccDealDto` | Global | Modificación |
| DELETE | `/meddpicc/deals/:id` | `MeddpiccController` | JWT | Propietario/admin | Param `id` | Global | Eliminación |
| POST | `/meddpicc/deals/:id/analyze` | `MeddpiccController` | JWT | Propietario/admin | `AnalyzeMeddpiccDealDto` | Global | IA, abuso de recursos |
| POST | `/meddpicc/deals/:id/convai/simulate-post-call` | `MeddpiccController` | JWT | Propietario/admin + env | Param `id` | Global | Debug protegido, integración externa |
| POST | `/meddpicc/deals/:id/convai/client-transcript` | `MeddpiccController` | JWT | Propietario/admin | `ClientConvaiTranscriptDto` | Global | IA, datos sensibles |
| POST | `/meddpicc/deals/:id/convai/import-from-elevenlabs` | `MeddpiccController` | JWT | Propietario/admin | `FetchElevenlabsConversationDto` | Global | Integración externa, abuso |
| POST | `/webhooks/elevenlabs/meddpicc` | `MeddpiccConvaiWebhookController` | Pública + firma | Firma ElevenLabs | Body webhook | 120/min | Público, webhook, integración externa |
| GET | `/kyc/clients?q=` | `KycController` | JWT | Usuario autenticado | Query `q` sin DTO | Global | Datos compartidos KYC |
| POST | `/kyc/linkedin-profile` | `KycController` | JWT | Usuario autenticado | `KycLinkedInProfileDto` | Global | Modificación auditada, extensión Chrome |
| GET | `/kyc/companies` | `KycController` | JWT | Usuario autenticado | Query `q`, `strategic`, `all`, `industry` sin DTO | Global | Datos compartidos, abuso de recursos |
| POST | `/kyc/companies` | `KycController` | JWT | Usuario autenticado | `Record<string, unknown>` | Global | Modificación auditada, validación débil |
| POST | `/kyc/companies/bulk-delete` | `KycController` | JWT | `ADMIN` o creador por empresa; legacy solo `ADMIN` | `BulkDeleteKycCompaniesDto` | 10/min | Eliminación masiva auditada de empresas KYC y datos asociados |
| POST | `/kyc/companies/import` | `KycController` | JWT + Admin | `ADMIN` | `ImportKycCompaniesDto` | 5/min | Modificación masiva auditada de catálogo corporativo |
| GET | `/kyc/companies/:id` | `KycController` | JWT | Usuario autenticado | Param `id` sin DTO | Global | Datos compartidos |
| PATCH | `/kyc/companies/:id` | `KycController` | JWT | Usuario autenticado | `Record<string, unknown>` | Global | Modificación auditada, validación débil |
| DELETE | `/kyc/companies/:id` | `KycController` | JWT | `ADMIN` o creador; legacy solo `ADMIN` | Param `id` | Global | Eliminación auditada de empresa KYC y datos asociados |
| POST | `/kyc/companies/:id/activate` | `KycController` | JWT | Usuario autenticado | Param `id` | Global | Modificación auditada |
| PATCH | `/kyc/companies/:id/profile` | `KycController` | JWT | Usuario autenticado | `Record<string, unknown>` + header | Global | Modificación auditada, validación débil |
| POST | `/kyc/companies/:id/profile/synthesize-summary` | `KycController` | JWT | Usuario autenticado | Param `id` | Global | IA auditada, abuso de recursos |
| POST | `/kyc/companies/:id/report-translate-en` | `KycController` | JWT | Usuario autenticado | Param `id` | Global | IA, abuso de recursos |
| GET | `/kyc/companies/:id/timeline` | `KycController` | JWT | Usuario autenticado | Param `id` | Global | Datos compartidos |
| POST | `/kyc/companies/:id/enrich` | `KycController` | JWT | Usuario autenticado | Param `id` | Global | IA auditada, integración externa |
| GET | `/kyc/companies/:id/org` | `KycController` | JWT | Usuario autenticado | Param `id` | Global | Datos personales compartidos |
| POST | `/kyc/companies/:id/org/members` | `KycController` | JWT | Usuario autenticado | `Record<string, unknown>` | Global | Modificación auditada, validación débil |
| PATCH | `/kyc/org/members/:id` | `KycController` | JWT | Usuario autenticado | `Record<string, unknown>` | Global | Modificación auditada, validación débil |
| DELETE | `/kyc/org/members/:id` | `KycController` | JWT | `ADMIN` o creador de la empresa; legacy solo `ADMIN` | Param `id` | Global | Eliminación auditada de recurso hijo KYC |
| POST | `/kyc/companies/:id/org/relationships` | `KycController` | JWT | Usuario autenticado | `Record<string, unknown>` | Global | Modificación auditada |
| DELETE | `/kyc/org/relationships/:id` | `KycController` | JWT | `ADMIN` o creador de la empresa; legacy solo `ADMIN` | Param `id` | Global | Eliminación auditada de relación KYC |
| GET | `/kyc/companies/:id/signals` | `KycController` | JWT | Usuario autenticado | Param `id` | Global | Datos compartidos |
| POST | `/kyc/companies/:id/signals` | `KycController` | JWT | Usuario autenticado | `Record<string, unknown>` | Global | Modificación auditada, validación débil |
| POST | `/kyc/companies/:id/signals/fetch-news` | `KycController` | JWT | Usuario autenticado | Param `id` | Global | Integración externa auditada, SSRF limitado por URL fija |
| POST | `/kyc/companies/:id/signals/infer-hypotheses` | `KycController` | JWT | Usuario autenticado | Param `id` | Global | IA auditada, abuso de recursos |
| GET | `/kyc/companies/:id/open-questions` | `KycController` | JWT | Usuario autenticado | Query `status`; param `id` | Global | Datos compartidos |
| POST | `/kyc/companies/:id/open-questions` | `KycController` | JWT | Usuario autenticado | `Record<string, unknown>` | Global | Modificación auditada |
| PATCH | `/kyc/open-questions/:id` | `KycController` | JWT | Usuario autenticado | `Record<string, unknown>` | Global | Modificación auditada |
| DELETE | `/kyc/open-questions/:id` | `KycController` | JWT | `ADMIN` o creador de la empresa; legacy solo `ADMIN` | Param `id` | Global | Eliminación auditada de pregunta KYC |
| GET | `/kyc/companies/:id/chat/sessions` | `KycController` | JWT | Usuario autenticado | Param `id` | Global | IA, datos compartidos |
| POST | `/kyc/companies/:id/chat/sessions` | `KycController` | JWT | Usuario autenticado | Inline `{ title?, type? }` | Global | IA, modificación |
| GET | `/kyc/chat/sessions/:sessionId/messages` | `KycController` | JWT | Usuario autenticado | Param `sessionId` | Global | IA, datos sensibles |
| POST | `/kyc/chat/sessions/:sessionId/stream` | `KycController` | JWT | Usuario autenticado | Inline `{ message? }` | Global | IA, SSE, propuestas aplicadas auditadas |
| GET | `/expenses` | `ExpensesController` | JWT | Propietario | Ninguno | Global | Datos sensibles, listado sin paginación |
| POST | `/expenses/extract` | `ExpensesController` | JWT | Propietario | Upload `file` | Global | Upload, IA, abuso de recursos |
| POST | `/expenses/convert-heic` | `ExpensesController` | JWT | Propietario | Upload `file` | Global | Upload, procesamiento costoso |
| POST | `/expenses/exports` | `ExpensesController` | JWT | Propietario | `GenerateExpenseExportDto` | Global | Exportación, operación costosa |
| POST | `/expenses/import-payload` | `ExpensesController` | JWT | Propietario | `GenerateExpenseExportDto` | Global | Datos sensibles |
| POST | `/expenses/import-status` | `ExpensesController` | JWT | Propietario | `SyncExpenseImportStatusDto` | Global | Modificación |
| POST | `/expenses/bulk-delete` | `ExpensesController` | JWT | Propietario | `BulkDeleteExpensesDto` (máx. 100 IDs) | 10/min | Eliminación masiva acotada por `userId` |
| POST | `/expenses/:id/retry-extract` | `ExpensesController` | JWT | Propietario | Param `id` | Global | IA, operación costosa |
| PATCH | `/expenses/:id` | `ExpensesController` | JWT | Propietario | `UpdateExpenseDto` | Global | Modificación |
| GET | `/expenses/:id` | `ExpensesController` | JWT | Propietario | Param `id` | Global | Datos sensibles |
| DELETE | `/expenses/:id` | `ExpensesController` | JWT | Propietario | Param `id` | Global | Eliminación |
| GET | `/expenses/:id/file` | `ExpensesController` | JWT | Propietario | Param `id` | Global | Descarga, datos sensibles |
| GET | `/public/expense-exports/:token/:fileName` | `PublicExpenseExportsController` | Pública + token | Token export | Params `token`, `fileName` | 60/min | Público, descarga por token |
| POST | `/webhooks/expense-email/inbound` | `ExpenseEmailWebhookController` | Pública + secreto | `EXPENSE_EMAIL_WEBHOOK_SECRET` | Body webhook flexible | 60/min | Público, webhook, upload base64, IA |
| POST | `/webhooks/make/callback` | `MakeCallbackController` | Pública + secreto | `MAKE_CALLBACK_SECRET` | Body callback flexible | 120/min | Público, webhook, modificación estado |
| GET | `/public/attachments/:token` | `PublicAttachmentsController` | Pública + token | Token público | Param `token` | 60/min | Público, descarga por token |
| GET | `/extensions/avvale-companion-extension.zip` | `ExtensionsController` | Pública | Ninguno | Ninguno | 60/min | Público, descarga artefacto |
| GET | `/health` | `HealthController` (`src/health.controller.ts`) | Pública | Ninguno | Ninguno | SkipThrottle | Healthcheck legacy live |
| GET | `/health/live` | `HealthController` (`src/health.controller.ts`) | Pública | Ninguno | Ninguno | SkipThrottle | Healthcheck live |
| GET | `/health/ready` | `HealthController` (`src/health/health.controller.ts`) | Pública | Ninguno | Ninguno | SkipThrottle | Healthcheck DB readiness |

## Endpoints de archivos

| Ruta | Tipo | Controles existentes | Riesgo residual |
| --- | --- | --- | --- |
| `/auth/me/avatar` | Upload/descarga avatar | Multer 2 MB en módulo, validación `validateSafeFile('avatar')` | Verificar límites tras JWT global |
| `/activations/:id/attachments/upload` | Upload adjunto | Multer 20 MB, `validateActivationAttachmentFile`, magic bytes | Rate limit específico pendiente |
| `/activations/:id/attachments/import-scanned-urls` | Descarga URL remota | Bloqueo de IPs privadas/metadata, redirects limitados, timeout | DNS rebinding residual |
| `/rfq-analyses/:id/sources` | Upload documentos | 20 files, límite por fichero, `validateSafeFile('rfq')` | Rate limit específico aplicado |
| `/meddpicc/deals/:id/attachments` | Upload documentos | 15 files, 25 MB, `validateSafeFile('meddpicc')` | Rate limit global; revisar específico si aumenta volumen |
| `/expenses/extract` | Upload recibo | Límite de fichero, `validateReceiptFile` | Rate limit IA/upload pendiente |
| `/expenses/convert-heic` | Upload imagen | Límite de fichero | Operación costosa |
| `/yubiq/approve-seal-filler/analyze` | Upload PDF | Límite Multer 20 MB + validación post-buffer | Rate limit específico aplicado |
| `/webhooks/rfq-email/inbound` | Adjuntos base64 | Validación segura por fichero | Body JSON 50 MB, rate limit específico aplicado |
| `/webhooks/expense-email/inbound` | Adjuntos base64 | Validación segura por fichero | Body JSON 50 MB, rate limit específico aplicado |

## Endpoints IA

| Ruta | Proveedor | Riesgo |
| --- | --- | --- |
| `/user/ai-credentials/anthropic/*` | Anthropic | Gestión de secreto de usuario |
| `/yubiq/approve-seal-filler/analyze` | Anthropic | Procesamiento de PDF; coste y fuga de prompt |
| `/yubiq/approve-seal-filler/translate` | Anthropic | Coste |
| `/rfq-analyses/:id/process` | Anthropic + BullMQ | Coste y procesamiento de documentos |
| `/rfq-analyses/:id/messages` | Anthropic | Prompt injection indirecta |
| `/expenses/extract` | Anthropic + BullMQ | Coste y datos sensibles |
| `/expenses/:id/retry-extract` | Anthropic + BullMQ | Coste |
| `/meddpicc/deals/:id/analyze` | Anthropic | Coste y datos sensibles |
| `/meddpicc/deals/:id/convai/*` | Anthropic / ElevenLabs | Datos sensibles de llamadas |
| `/kyc/companies/:id/profile/synthesize-summary` | Anthropic | Coste |
| `/kyc/companies/:id/report-translate-en` | Anthropic | Coste |
| `/kyc/companies/:id/enrich` | Anthropic / RSS externo | Coste e integración externa |
| `/kyc/companies/:id/signals/infer-hypotheses` | Anthropic | Coste |
| `/kyc/chat/sessions/:sessionId/stream` | Anthropic SSE | Coste, prompt injection indirecta |

## Webhooks

| Ruta | Verificación | Observaciones |
| --- | --- | --- |
| `POST /webhooks/make/callback` | Secreto compartido en body | Comparación no timing-safe en revisión inicial |
| `POST /webhooks/rfq-email/inbound` | Secreto compartido en body | Comparación no timing-safe en revisión inicial |
| `POST /webhooks/expense-email/inbound` | Secreto compartido en body | Comparación no timing-safe en revisión inicial |
| `POST /webhooks/elevenlabs/meddpicc` | HMAC + `timingSafeEqual` | Mejor patrón actual |

## Tareas, workers y colas

No se encontró `ScheduleModule` ni `@Cron`.

| Cola | Processor | Uso |
| --- | --- | --- |
| `activation-send` | `backend/src/queue/activation-send.processor.ts` | Envío de activaciones / integración Make |
| `rfq-analysis` | `backend/src/queue/rfq-analysis.processor.ts` | Procesamiento de RFQ con IA |
| `expense-extract` | `backend/src/queue/expense-extract.processor.ts` | Extracción de gastos con IA |

## Integraciones externas

| Integración | Uso | Riesgos |
| --- | --- | --- |
| Anthropic | Yubiq, RFQ, MEDDPICC, KYC, expenses | Coste, prompt injection, timeouts, secretos |
| SMTP/Nodemailer | Magic links, invitaciones, notificaciones | Secretos SMTP, enlaces mágicos en logs |
| Make.com | Webhook saliente y callback de activaciones | Webhook público, estado remoto |
| ElevenLabs | ConvAI MEDDPICC y webhook | Firma HMAC, API key |
| Redis/BullMQ | Colas | Disponibilidad, ready check |
| RSS Google News | KYC signals | URL fija con query de usuario |

## Operaciones de base de datos relevantes

- Usuarios, invitaciones, tokens mágicos, credenciales Anthropic cifradas.
- Activaciones y adjuntos.
- RFQ analyses, sources, insights, messages y job events.
- MEDDPICC deals, attachments e historial.
- Expenses y exports.
- KYC companies, profiles, contacts, org members, signals, questions, chat sessions/messages, facts y `kyc_audit_logs`.

Riesgos transversales detectados:

- KYC es catálogo corporativo compartido por diseño; lectura/edición colaborativa, borrado restringido a `ADMIN` o creador y cambios persistidos en `kyc_audit_logs`.
- Listados `activations` y `expenses` paginados con límites máximos.
- Uso puntual de `$queryRawUnsafe` con SQL estático en processor.
- Falta de DTOs estrictos en varias rutas KYC y algunas queries/params.
