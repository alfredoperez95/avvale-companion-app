# Revisión de seguridad backend

Fecha: 2026-07-18

## Resumen ejecutivo

El backend NestJS tiene una base razonable: JWT Bearer, `ValidationPipe` global, Helmet, CORS con allowlist, Throttler global, validación de ficheros con magic bytes, tokens mágicos con hash y controles SSRF parciales en importación de adjuntos.

Los riesgos principales antes de remediar son: registro público abierto, autenticación fail-open para nuevos controllers, JWT sin revocación ni `issuer`/`audience`, un upload Yubiq sin límite Multer explícito, ausencia de filtro global de errores, rate limits insuficientes para IA/uploads, DTOs débiles en KYC y comparaciones de secretos de webhooks no timing-safe.

## Alcance

Revisado:

- Módulos y controllers NestJS en `backend/src/`.
- Bootstrap, CORS, Helmet, ValidationPipe, throttling y healthchecks.
- Autenticación JWT, magic links, invitaciones y guards.
- Autorización endpoint por endpoint, incluyendo ownership y modelo compartido KYC.
- Uploads, descargas públicas por token y validación de ficheros.
- Endpoints IA y llamadas a Anthropic / ElevenLabs / Make / SMTP.
- Prisma, raw SQL, paginación y operaciones costosas.
- Variables de entorno y comprobaciones de producción existentes.

No revisado todavía con ejecución:

- `npm audit` / `npm outdated`.
- Suite completa de tests, lint y build.
- Configuración real de Coolify/Traefik fuera del repositorio.
- Historial Git completo de secretos.

## Arquitectura revisada

```mermaid
flowchart LR
  Client[Next_frontend_extension]
  Nest[NestJS_backend]
  MySQL[(MySQL_Prisma)]
  Redis[(Redis_BullMQ)]
  Anthropic[Anthropic_API]
  SMTP[SMTP]
  Make[Make_webhooks]
  EL[ElevenLabs]

  Client -->|"Bearer JWT"| Nest
  Nest --> MySQL
  Nest --> Redis
  Nest --> Anthropic
  Nest --> SMTP
  Nest --> Make
  Nest --> EL
```

Inventario completo: `docs/BACKEND_ENDPOINT_INVENTORY.md`.

## Hallazgos

| ID | Severidad | Hallazgo | Componente | Impacto | Recomendación | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| B-01 | High | Registro público abierto y enumeración de email | `backend/src/auth/auth.controller.ts`, `backend/src/auth/auth.service.ts` | Creación no autorizada de usuarios y descubrimiento de cuentas | Deshabilitar registro público; mantener alta por invitación | MITIGATED |
| B-02 | High | Sesiones sin revocación servidor; access token default 5 días | `backend/src/auth/auth.module.ts` | Robo de JWT válido hasta expiración | Reducir TTL, endurecer claims; planificar revocación/rotación de secretos | IN PROGRESS |
| B-03 | High | Upload Yubiq sin `limits.fileSize` en Multer | `backend/src/yubiq/approve-seal-filler/approve-seal-filler.controller.ts` | DoS por memoria antes de validar magic bytes | Añadir límite Multer explícito y DTO para `model` | MITIGATED |
| B-04 | High | Auth fail-open: JWT guard no es global | `backend/src/app.module.ts` | Un controller nuevo sin guard queda público | Introducir `APP_GUARD` JWT global y decorador `@Public` | MITIGATED |
| B-05 | Medium | Fallbacks de secretos en JWT, magic e invitaciones | `backend/src/auth/*`, `backend/src/invitations/*` | Riesgo de arranque inseguro fuera de producción | Eliminar fallbacks runtime o validarlos con fail-fast | MITIGATED |
| B-06 | Medium | JWT sin `algorithms`, `issuer` ni `audience` explícitos | `backend/src/auth/auth.module.ts`, `backend/src/auth/strategies/jwt.strategy.ts` | Tokens aceptados con validación incompleta de contexto | Fijar algoritmo HS256 y validar `iss`/`aud` configurables | MITIGATED |
| B-07 | Medium | Sin filtro global de excepciones | `backend/src/main.ts` | Posible exposición de errores técnicos / proveedores | Añadir filter global con `requestId` y sanitización | MITIGATED |
| B-08 | Medium | Rate limiting insuficiente para IA/uploads/exportaciones | `backend/src/app.module.ts`, controllers IA/upload | Abuso de coste y recursos | Añadir throttles por categoría crítica | MITIGATED |
| B-09 | Medium | KYC usa cuerpos inline / `Record<string, unknown>` sin DTOs estrictos | `backend/src/kyc/kyc.controller.ts` | Validación incompleta, payloads excesivos, mass assignment mitigado solo en service | Crear DTOs mínimos y límites de tamaño | IN PROGRESS |
| B-10 | Medium | Webhooks Make/RFQ/expense comparan secreto con `!==` | Servicios de Make, RFQ, expenses | Timing side-channel y patrón inconsistente | Helper timing-safe para secretos | MITIGATED |
| B-11 | Medium | Tokens públicos de adjuntos pueden quedar sin expiración | `backend/src/attachments/attachments.service.ts` | Acceso por token más largo de lo esperado si falla callback | Establecer expiración siempre al publicar | MITIGATED |
| B-12 | Medium | `MAIL_SKIP_SEND` registra URL mágica completa | `backend/src/mail/mail.service.ts`, `backend/src/main.ts` | Exposición de token en logs | Prohibir en producción y redactar tokens en logs | MITIGATED |
| B-13 | Medium | Listados sin paginación | `activations`, `expenses` | Abuso de recursos y respuestas grandes | Añadir paginación compatible con límites máximos | MITIGATED |
| B-14 | Medium | SSRF residual por DNS rebinding | `backend/src/attachments/attachments.service.ts` | Cambio de IP entre validación y conexión | Documentar residual y reforzar donde sea práctico | ACCEPTED |
| B-15 | Medium | `ValidationPipe` no fija `forbidUnknownValues` ni desactiva conversión implícita | `backend/src/main.ts` | Validación menos estricta de objetos extraños | Ajustar pipe global tras comprobar compatibilidad | MITIGATED |
| B-16 | Medium | Magic link no se consume de forma atómica | `backend/src/auth/auth.service.ts` | Posible doble uso concurrente | Usar update condicionado a `usedAt: null` | MITIGATED |
| B-17 | Medium | `trust proxy` no configurado/documentado | `backend/src/main.ts` | Rate limit por IP impreciso detrás de Traefik | Configurar solo para proxy conocido y documentar Coolify/Traefik | MITIGATED |
| B-18 | Low | Dos controllers `GET /health` | `backend/src/health.controller.ts`, `backend/src/health/health.controller.ts` | Healthcheck ambiguo | Separar `/health/live` y `/health/ready` | MITIGATED |
| B-19 | Low | `$queryRawUnsafe` estático en processor | `backend/src/queue/activation-send.processor.ts` | Bajo al no usar input de usuario | Sustituir por consulta segura o documentar | ACCEPTED |
| B-20 | Informational | Swagger ausente | Backend | Sin superficie Swagger pública | Mantener deshabilitado o proteger si se añade | NOT APPLICABLE |
| B-21 | Informational | CSRF clásico no aplica al usar Bearer, no cookies de sesión | Auth | Riesgo mitigado por no usar cookies auth | Mantener CORS estricto y no mezclar cookies sin CSRF | NOT APPLICABLE |
| B-22 | Medium | KYC compartido entre usuarios autenticados por decisión de negocio | `backend/src/kyc` | Cualquier usuario autenticado puede leer y operar sobre el catálogo KYC corporativo; no hay aislamiento por usuario/tenant en este módulo | Documentar como excepción explícita; reabrir si KYC contiene datos segregados por equipo/cliente o aumenta sensibilidad | ACCEPTED |
| B-23 | Informational | Validación de ficheros con magic bytes ya existe | `backend/src/files/safe-file-validation.ts` | Reduce riesgo de MIME/extensión falsa | Mantener allowlists y ampliar antivirus en infraestructura | MITIGATED |
| B-24 | Medium | Parsers/conversores de adjuntos complejos podían ejecutarse en el proceso Nest principal | PDF, Excel, HEIC, DOCX, EML | DoS por CPU/memoria o fallo del proceso principal ante ficheros maliciosos | Aislar procesamiento en workers con timeout y memoria limitada | MITIGATED |
| B-25 | Medium | Respuesta Yubiq exponía el prompt completo con texto extraído del PDF | `backend/src/yubiq/approve-seal-filler/approve-seal-filler.controller.ts` | Exposición de contenido sensible de documentos en respuesta API/logs cliente | Devolver huella (`promptHash`) en vez de prompt completo | MITIGATED |
| B-26 | Medium | Export CSV de gastos susceptible a formula injection | `backend/src/expenses/expense-export.service.ts` | Ejecución de fórmulas al abrir CSV en hojas de cálculo | Neutralizar celdas que empiezan por `=`, `+`, `-`, `@`, tab o CR | MITIGATED |
| B-27 | Low | Recibos de gastos se servían inline | `backend/src/expenses/expenses.controller.ts` | Renderizado accidental de contenido subido por usuario en navegador | Servir como `attachment` y mantener `nosniff` | MITIGATED |
| B-28 | Low | Regla de selección `kycCompanyId` en RFQ estaba implícita | `backend/src/rfq-analysis/rfq-analysis.service.ts` | Riesgo de cambios futuros que rompan el modelo compartido o acepten empresas no activas | Helper explícito y tests de empresa inexistente/sin perfil/compartida activa | MITIGATED |

## Evidencias técnicas

### Autenticación y JWT

- `JwtAuthGuard` es opt-in por controller; el único `APP_GUARD` actual es `ThrottlerGuard`.
- `JwtModule` firma con `JWT_SECRET` o fallback y `JWT_EXPIRES_IN` por defecto `5d`.
- `JwtStrategy` extrae solo Bearer y valida expiración, pero no fija `algorithms`, `issuer` ni `audience`.
- No existen refresh tokens ni endpoint de logout servidor.

### Magic links e invitaciones

- Los tokens se generan con `randomBytes(32)` y se almacenan hasheados con SHA-256 y secreto servidor.
- La petición de magic link usa respuesta genérica anti-enumeración.
- El consumo de magic link hace lectura y actualización separadas; debe hacerse atómico.

### Autorización

- Áreas administrativas usan `AdminGuard`.
- Activations, RFQ, MEDDPICC y expenses aplican ownership por `userId` en servicios.
- KYC se acepta como catálogo corporativo compartido entre usuarios autenticados. En este módulo no se aplica aislamiento por `createdByUserId`, tenant ni equipo: lectura, edición y operaciones sobre empresas KYC se consideran colaborativas por decisión funcional. Esta excepción debe reabrirse si se introducen datos segregados por comercial/equipo, clientes con confidencialidad diferenciada o roles KYC específicos.

### Decisión aceptada: KYC compartido

Fecha de confirmación: 2026-07-21.

El módulo KYC queda tratado como **catálogo corporativo compartido**, no como recurso privado del usuario que crea o edita una empresa. Por tanto:

- Cualquier usuario autenticado puede consultar empresas KYC con perfil activo.
- Cualquier usuario autenticado puede operar sobre la ficha KYC, organigrama, señales, preguntas abiertas y sesiones asociadas, según los endpoints actuales.
- `createdByUserId` se conserva como metadato de origen, no como límite de autorización.
- `updatedByUserId` y `kyc_audit_logs` registran cambios relevantes sin almacenar prompts/documentos completos.
- Los RFQ vinculados a una empresa KYC siguen siendo privados por `userId`; la empresa KYC vinculada es el catálogo compartido.
- `DELETE /kyc/companies/:id` y `POST /kyc/companies/bulk-delete` eliminan la empresa base `KycCompany` y sus datos KYC asociados. Solo pueden ejecutarlos `ADMIN` o el creador de la empresa; registros legacy sin `createdByUserId` solo pueden ser eliminados por `ADMIN`.
- `POST /kyc/companies/import` queda restringido a `ADMIN` por ser una operación masiva sobre el catálogo corporativo compartido.

Riesgo aceptado: bajo este modelo, un usuario autenticado puede modificar datos KYC usados por otros usuarios. Se acepta como comportamiento colaborativo corporativo. Mitigación operativa aplicada: historial backend con `updatedByUserId` y `KycAuditLog` para creación, edición, importación, borrado, organigrama, señales, preguntas abiertas, enriquecimiento IA y propuestas aplicadas desde chat. Recomendación futura no bloqueante: exponer consulta de historial en UI/admin si se necesita operación diaria o investigación desde producto.

### Uploads

- `safe-file-validation.ts` detecta PDF, Office/ZIP, imágenes y ejecutables por firma.
- Yubiq valida después de recibir el buffer, pero `FileInterceptor('file')` no define límite Multer.
- Descargas autenticadas aplican `Content-Disposition` y `X-Content-Type-Options` en varios endpoints.

### SSRF

- `AttachmentsService.downloadFromUrl` bloquea localhost, metadata, redes privadas y redirecciones peligrosas.
- Riesgo residual: DNS rebinding entre `lookup` y `fetch`.

### Logging y errores

- No hay `ExceptionFilter` global.
- `MAIL_SKIP_SEND=true` puede registrar enlaces mágicos completos.
- No hay redactor central de campos sensibles.

## Recomendación de implementación

Aplicar correcciones por bloques:

1. Bloque A: cerrar registro público, auth fail-closed, límite Yubiq, webhooks timing-safe, magic link atómico, JWT claims.
2. Bloque B: filtro de errores, requestId, logging/redacción, throttles específicos, DTOs KYC/Yubiq, baseline.
3. Bloque C: paginación, health live/ready, timeouts, dependencias y tests de seguridad.

## Secretos a revisar o rotar manualmente

No se listan valores de secretos.

- `JWT_SECRET`: rotar tras incidente o si hubo exposición de tokens.
- `MAGIC_LINK_SECRET`: rotar si se reutiliza `JWT_SECRET` o hay sospecha de logs.
- `INVITE_TOKEN_SECRET`: configurar fuerte y separado.
- `ANTHROPIC_API_KEY_MASTER_KEY`: rotar si hubo exposición del backend o DB.
- `SMTP_PASS`, `MAKE_WEBHOOK_SECRET`, `MAKE_CALLBACK_SECRET`, `RFQ_EMAIL_WEBHOOK_SECRET`, `EXPENSE_EMAIL_WEBHOOK_SECRET`, `ELEVENLABS_WEBHOOK_SECRET`, `ELEVENLABS_API_KEY`: rotar según política post-incidente.

## Cambios aplicados

- `POST /auth/register` responde `410 Gone`; el alta queda por invitación.
- `JwtAuthGuard` queda como `APP_GUARD`; los endpoints públicos usan `@Public()`.
- JWT firma y verifica con `HS256`, `issuer` y `audience`.
- Se eliminan fallbacks literales de JWT/magic/invitaciones.
- Magic links se consumen con `updateMany` condicionado a `usedAt: null` y `expiresAt`.
- Yubiq aplica límite Multer de 20 MB y DTO para `model`.
- Webhooks Make/RFQ/expenses usan comparación timing-safe.
- `ValidationPipe` activa `forbidUnknownValues` y desactiva conversión implícita.
- Se añade `requestId`, filtro global de excepciones y logging HTTP sin cuerpos.
- Se añade redacción central de campos sensibles.
- `MAIL_SKIP_SEND=true` queda bloqueado en producción y el log local omite la URL mágica.
- Tokens públicos de adjuntos expiran siempre.
- Se añaden throttles específicos para IA, uploads, exportaciones e importaciones masivas.
- KYC incorpora DTOs para creación/importación/borrado/chat.
- `activations` y `expenses` tienen paginación máxima de 100 items.
- Healthchecks separados: `/health/live` y `/health/ready`; `/health` queda como compatibilidad live.
- Timeouts explícitos añadidos a Anthropic, ElevenLabs y Google News RSS.
- `docs/BACKEND_SECURITY_BASELINE.md` creado.

Actualización adicional aplicada el 2026-07-21:

- Procesamiento de PDF aislado en `pdf-extraction-worker` con timeout, límite de memoria y truncado de salida.
- Procesamiento de Excel aislado en `rfq-spreadsheet-worker` con timeout, límite de memoria y truncado de salida.
- Conversión HEIC/HEIF aislada en `expense-heic-worker`.
- Parsing DOCX/EML de MEDDPICC aislado en `meddpicc-document-worker`.
- Yubiq deja de devolver `promptPreview`; devuelve `promptHash`.
- Export CSV de gastos neutraliza formula injection.
- `GET /expenses/:id/file` sirve recibos como `attachment` y mantiene `X-Content-Type-Options: nosniff`.
- RFQ encapsula la validación de empresa KYC seleccionable y añade tests para el modelo KYC compartido con perfil activo.
- Operaciones destructivas KYC: borrado restringido a `ADMIN` o creador; import masivo restringido a `ADMIN`.
- Auditoría KYC backend: `updatedByUserId` y `kyc_audit_logs` con eventos minimizados para cambios manuales, importaciones, borrados, enriquecimiento IA y propuestas de chat.
- Operaciones destructivas de activaciones: `ADMIN` puede borrar activaciones ajenas; usuarios normales siguen limitados a sus propias activaciones.
- `POST /expenses/bulk-delete` incorpora límite de 100 IDs y throttle específico.
- El processor de envío de activaciones revalida que el `userId` del job coincide con `createdByUserId` antes de cambiar estado.

## Dependencias

Se ejecutó `npm audit fix` sin `--force`. Se actualizó `backend/package-lock.json` con parches compatibles.

Actualización adicional aplicada el 2026-07-19:

- NestJS runtime actualizado a v11 (`@nestjs/common`, `core`, `platform-express`, `config`, `jwt`, `passport`) para mitigar la cadena `@nestjs/core` / `platform-express` / `multer` / `qs` / `file-type` / `lodash`.
- `main.ts` fija `query parser = extended` y métodos/headers CORS explícitos para compatibilidad con Express 5.
- Runtime Node validado: backend/frontend declaran `node >=20 <23`, ejecutan comprobación `preinstall`, y Docker usa `node:22-alpine`.
- `nodemailer` actualizado a v9. La validación TLS estricta queda activa; no se añade `tls.rejectUnauthorized=false`.
- `bcrypt` actualizado a v6 para retirar la cadena vulnerable `node-pre-gyp` / `tar`. Los hashes existentes siguen siendo compatibles.
- `xlsx` sustituido por `@stackline/xlsx` y el parsing Excel se ejecuta en proceso hijo con timeout y límite de memoria.

Residual:

- Sin vulnerabilidades conocidas reportadas por `npm audit` en la última validación documentada. El procesamiento de documentos mantiene riesgo residual operativo por tratar ficheros no confiables, mitigado mediante aislamiento de workers, límites de tiempo/memoria y validación previa de tipo/tamaño.

## Estado de pruebas

- Lints IDE: sin errores en archivos modificados.
- Backend `npm test`: 7 archivos, 33 tests, todos pasan.
- Backend `npm run build`: OK.
- Backend `npm audit`: 0 vulnerabilidades.
- Frontend `npm audit`: 0 vulnerabilidades.
- Frontend `npm test`: 7 archivos, 43 tests, todos pasan.
- Frontend `npm run build`: OK. Aviso local no bloqueante: `INTERNAL_API_URL` no definido, por lo que los rewrites `/api` usan `http://localhost:4000`; en Coolify debe configurarse con la URL interna del backend.
- Smoke de extracción Excel/PDF/EML/HEIC workers: OK.
- `npm outdated`: quedan actualizaciones no aplicadas en Prisma, BullMQ, Helmet, tipos y majors de tooling; no están reportadas por `npm audit`.
