# Arquitectura de seguridad

Fecha: 2026-07-21

Este documento describe la arquitectura de seguridad vigente de Avvale Companion App. No sustituye a los informes de auditoría ni al inventario de endpoints; los resume en una referencia mantenible para desarrollo, operación, auditorías y certificaciones.

Documentos relacionados:

- `docs/BACKEND_ENDPOINT_INVENTORY.md`
- `docs/BACKEND_SECURITY_BASELINE.md`
- `SECURITY_REVIEW_BACKEND.md`
- `docs/CONTAINER_SECURITY_BASELINE.md`
- `SECURITY_REVIEW_CONTAINERS.md`
- `docs/CONTAINER_SECURITY_INVENTORY.md`

## 1. Alcance

La aplicación es un monorepo con:

- Frontend Next.js en `frontend/`.
- Backend NestJS en `backend/`.
- Base de datos MySQL/MariaDB vía Prisma.
- Redis/BullMQ para colas.
- Almacenamiento de adjuntos en filesystem mediante `ATTACHMENTS_DIR`.
- Integraciones externas con Anthropic, ElevenLabs, Make, SMTP y RSS/Google News.

La frontera principal de seguridad del producto es el backend NestJS. El frontend consume la API con Bearer JWT y no debe considerarse una barrera de autorización.

## 2. Modelo De Confianza

Actores principales:

- Usuario autenticado `USER`.
- Administrador `ADMIN`.
- Endpoints públicos controlados por token temporal o secreto compartido.
- Servicios externos: Make, ElevenLabs, SMTP, Anthropic.
- Procesos internos: workers BullMQ y procesos hijo para parsers.

Supuestos:

- No hay multi-tenant organizacional completo en el modelo actual.
- La mayoría de recursos privados se aíslan por `userId` o `createdByUserId`.
- KYC es una excepción funcional documentada como catálogo corporativo compartido.
- Los tokens públicos son capability URLs: quien posee el enlace puede acceder al recurso hasta expiración.

## 3. Autenticación

El backend usa JWT Bearer en `Authorization: Bearer <token>`.

Controles aplicados:

- `JwtAuthGuard` registrado como guard global.
- Endpoints públicos deben marcarse explícitamente con `@Public()`.
- JWT con secreto fuerte requerido en producción.
- Firma/verificación con algoritmo fijado y claims de contexto (`issuer`, `audience`) configurables.
- Registro público deshabilitado; alta mediante invitación.
- Magic links con token aleatorio, hash almacenado y consumo atómico.
- `assertProductionSecrets` impide arrancar en producción con secretos débiles o configuración insegura.

Decisiones:

- No se usan cookies de sesión para autenticación principal, por lo que CSRF clásico no aplica al flujo JWT actual.
- La revocación servidor de JWT sigue siendo una mejora futura: hoy la invalidación inmediata requiere rotar `JWT_SECRET`, cerrando sesiones activas.

## 4. Autorización

Patrones de autorización:

- Recursos privados: `userId` o `createdByUserId`.
- Recursos administrativos: `AdminGuard`.
- Recursos compartidos: documentados explícitamente.
- Webhooks públicos: secreto/HMAC y validaciones adicionales.
- Descargas públicas: token temporal no adivinable.

Dominios privados:

- `expenses`: propietario por `userId`.
- `rfq-analysis`: propietario por `userId`.
- `meddpicc`: propietario por `userId`; `ADMIN` puede acceder transversalmente.
- `activations`: propietario por `createdByUserId`; `ADMIN` puede listar/ver/borrar según reglas vigentes.
- credenciales Anthropic: siempre por `userId`.
- plantillas/firma: propietario o admin según tipo de recurso.

Hardening aplicado:

- Mutaciones críticas de expenses y RFQ usan `id + userId` en la propia operación (`updateMany` / `deleteMany`) cuando Prisma no dispone de `where` único compuesto.
- Workers revalidan ownership antes de mutar estado.
- RFQ no expone `storagePath` en respuestas API.
- KYC chat valida `sessionId + userId`.

## 5. Decisiones Funcionales

### KYC Como Catálogo Compartido

KYC queda tratado como catálogo corporativo compartido:

- Cualquier usuario autenticado puede leer y editar fichas KYC.
- `createdByUserId` es metadato de origen, no límite general de autorización.
- `updatedByUserId` y `kyc_audit_logs` registran cambios.
- Borrado de empresa KYC queda restringido a `ADMIN` o creador.
- Registros legacy sin creador solo los elimina `ADMIN`.
- Import masivo KYC es admin-only.

Excepción:

- Las sesiones de chat KYC son personales y se validan con `userId`.

Reabrir esta decisión si:

- KYC empieza a contener información segregada por equipo, comercial, cliente o contrato.
- Se introduce tenant/organización.
- Se requiere confidencialidad diferenciada por oportunidad.

### Capability URLs

Se aceptan URLs públicas temporales para:

- Adjuntos de activaciones enviados a Make.
- Recibos incluidos en exports de gastos.

Mitigaciones:

- Token UUID no adivinable.
- TTL.
- Limpieza/revocación de tokens expirados.
- `Cache-Control: no-store` en adjuntos públicos.
- Validación de `fileName` contra `expenseIds` en exports de gastos.
- No registrar tokens.

## 6. Adjuntos Y Ficheros

Controles generales:

- Límite de tamaño en endpoints de upload.
- Validación de extensión, MIME y magic bytes con `validateSafeFile`.
- Nombres internos aleatorios o saneados.
- Rutas acotadas con `resolvePathWithinBase`.
- Descargas con `Content-Disposition: attachment` cuando el contenido procede del usuario.
- `X-Content-Type-Options: nosniff`.

Flujos principales:

- Activaciones: upload autenticado, importación desde URLs externas, descarga autenticada por owner, descarga pública temporal para Make.
- Expenses: recibos privados por owner, exports temporales por token.
- RFQ: documentos asociados a análisis privados por owner; no hay descarga binaria pública.
- MEDDPICC: adjuntos por deal con acceso owner/admin.
- Yubiq: PDF procesado en memoria, sin persistencia de fichero.

SSRF:

- Descarga de URLs remotas bloquea localhost, metadata, IPs privadas, link-local y redirecciones excesivas.
- Riesgo residual aceptado: DNS rebinding entre resolución previa y `fetch`.

Procesamiento aislado:

- PDF en worker/proceso hijo.
- Excel en worker/proceso hijo.
- HEIC/HEIF en worker/proceso hijo.
- DOCX/EML en worker/proceso hijo.
- Timeouts, límites de memoria y truncado de salida donde aplica.

## 7. IA

Proveedores:

- Anthropic para Yubiq, RFQ, MEDDPICC, KYC y expenses.
- ElevenLabs para ConvAI MEDDPICC.

Controles:

- Credenciales Anthropic de usuario almacenadas y accedidas por `userId`.
- Timeouts explícitos en llamadas externas.
- Throttles específicos en endpoints de IA o procesamiento costoso.
- Límites de upload/contexto.
- No se devuelven prompts completos sensibles; Yubiq devuelve `promptHash`.
- Snapshots de auditoría KYC minimizados: no guardar prompts, documentos completos, tokens ni respuestas IA completas.

Riesgos residuales:

- Prompt injection indirecta desde documentos/correos no confiables.
- Coste por abuso de endpoints autenticados.
- Calidad y alucinación de respuestas IA.

Mitigaciones operativas recomendadas:

- Monitorizar volumen de llamadas por usuario.
- Mantener límites de tamaño/contexto.
- Revisar prompts cuando se añadan herramientas o acciones automáticas.

## 8. Workers Y Colas

BullMQ/Redis se usa para:

- Envío de activaciones a Make.
- Procesamiento RFQ.
- Extracción de gastos.

Controles:

- Workers validan que el recurso pertenece al `userId` del job antes de procesar.
- `ActivationSendProcessor.onFailed` revalida owner antes de marcar `FAILED` o `RETRYING`.
- `rfq-analysis.processor` y `expense-extract.processor` tratan mismatches como no recuperables sin mutar recursos ajenos.
- Reintentos y backoff configurables.
- Shutdown hooks habilitados en Nest.

Decisión actual:

- API y processors comparten proceso/contenedor en v1.

Evolución recomendada:

- Separar workers BullMQ en contenedor dedicado si aumenta volumen, coste o riesgo de documentos.
- Definir límites de CPU/mem/PIDs independientes para workers.

## 9. Webhooks

Webhooks públicos:

- Make callback.
- RFQ email inbound.
- Expense email inbound.
- ElevenLabs ConvAI MEDDPICC.

Controles:

- Endpoints públicos marcados con `@Public()`.
- Secretos compartidos comparados con helper timing-safe donde aplica.
- ElevenLabs usa HMAC con `elevenlabs-signature`.
- ConvAI MEDDPICC exige `conversation_initiation_client_data.dynamic_variables.deal_id`; no usa `data.user_id` como fallback de autorización.
- Webhooks de email resuelven usuario por remitente registrado y crean recursos bajo ese `userId`.
- Rate limits específicos.

Riesgos residuales:

- Si un secreto webhook se filtra, puede haber abuso de escritura.
- Las integraciones externas deben proteger logs y payloads.

Operación:

- Rotar secretos tras incidente o sospecha.
- Preferir allowlist de IPs cuando el proveedor y el despliegue lo permitan.

## 10. Auditoría

Auditoría funcional principal:

- `AuditLog` / `audit_logs` como consulta operativa global.
- `KycAuditLog` / `kyc_audit_logs` se conserva como histórico interno.
- `updatedByUserId` en `KycCompany`.
- Endpoint admin `GET /audit-logs`.
- UI admin `/admin/audit`.

Eventos cubiertos:

- Creación/importación/edición/borrado de empresas KYC.
- Perfil KYC.
- Organigrama.
- Relaciones.
- Señales.
- Preguntas abiertas.
- Enriquecimiento/síntesis IA.
- Propuestas aplicadas desde chat.

Principios:

- Actor, acción, entidad y metadatos minimizados.
- No almacenar prompts completos, documentos completos, tokens ni respuestas IA completas.
- Logs de auditoría sobreviven al borrado de empresa con `companyId` nullable y metadatos de identificación cuando aplica.

## 11. Logs Y Errores

Controles:

- `requestId` por request.
- Filtro global de excepciones con respuesta sanitizada.
- Logging HTTP sin cuerpos.
- Redacción central de campos sensibles.
- Magic links no se imprimen completos en logs.
- `MAIL_SKIP_SEND=true` bloqueado en producción.

No deben registrarse:

- JWT.
- Magic links.
- Tokens públicos.
- API keys.
- Passwords/secrets.
- Prompts completos con datos sensibles.
- Documentos completos o texto extraído extenso.

Operación:

- Configurar rotación de logs en Coolify/Docker/host.
- Activar access logs de proxy para investigación forense cuando sea posible.

## 12. Backups Y Recuperación

Datos que requieren backup:

- MySQL/MariaDB.
- Volumen `ATTACHMENTS_DIR`.
- Configuración de Coolify/variables de entorno fuera del repo.
- Redis solo si se decide persistir colas; para colas efímeras, priorizar capacidad de reintento/idempotencia.

Política recomendada:

- Backup automático diario de base de datos.
- Retención mínima diferenciada: diarios/semanales/mensuales según criticidad.
- Backup del volumen de adjuntos con la misma cadencia o cadencia proporcional al uso.
- Prueba periódica de restauración, no solo existencia de backup.
- Verificación antes de migraciones Prisma en staging/producción.

Puntos críticos:

- No probar borrados sobre datos reales.
- Antes de `prisma migrate deploy` en producción, confirmar backup reciente y recuperable.
- Tras incidente de RCE o exposición de secretos, rotar secretos además de restaurar/reconstruir.

## 13. Despliegue Y Contenedores

Arquitectura:

- `frontend/Dockerfile`: Next.js standalone, `node:22-alpine`, usuario no root.
- `backend/Dockerfile`: NestJS, Prisma, usuario no root, dependencias productivas.
- Dockerfile raíz PHP/Apache legacy eliminado.
- Coolify/Traefik como capa de despliegue/proxy.

Controles aplicados:

- Imágenes Node 22 Alpine.
- Multi-stage builds.
- Usuario no root.
- `.dockerignore` para evitar secretos/contexto innecesario.
- Healthchecks.
- `wget` mínimo aceptado por compatibilidad con Coolify.

Controles runtime pendientes de entorno:

- `read_only`.
- `/tmp` como tmpfs con `noexec,nosuid,nodev`.
- `cap_drop: ALL`.
- `security_opt: no-new-privileges:true`.
- Límites CPU/mem/PIDs.
- Rotación de logs.
- Redes internas para MySQL/MariaDB y Redis.

Regla operativa:

- No publicar puertos de base de datos ni Redis a internet.
- No exponer Traefik dashboard.
- No montar Docker socket en contenedores de aplicación.

## 14. Límites Y Throttling

Límites relevantes:

- Body HTTP global configurable con `HTTP_BODY_LIMIT`, actualmente pensado para webhooks con base64.
- Uploads con límite por endpoint/contexto.
- Endpoints IA/upload/export/import masivo con throttles específicos.
- Paginación máxima en listados relevantes.
- Bulk delete expenses limitado a 100 IDs.
- Public downloads con rate limit.
- Workers/parsers con timeout y límites de memoria.

Riesgos residuales:

- Usuarios autenticados pueden consumir recursos hasta los límites configurados.
- Procesamiento de documentos no confiables mantiene riesgo operativo residual.

Recomendación:

- Revisar límites con métricas reales.
- Separar workers si hay procesamiento pesado sostenido.

## 15. Variables Y Secretos Críticos

Secretos/configuración que deben existir y ser fuertes en producción:

- `DATABASE_URL`
- `JWT_SECRET`
- `MAGIC_LINK_SECRET`
- `INVITE_TOKEN_SECRET`
- `ANTHROPIC_API_KEY_MASTER_KEY`
- `CORS_ORIGIN`
- `SMTP_*`
- `MAKE_WEBHOOK_SECRET`
- `MAKE_CALLBACK_SECRET`
- `RFQ_EMAIL_WEBHOOK_SECRET`
- `EXPENSE_EMAIL_WEBHOOK_SECRET`
- `ELEVENLABS_WEBHOOK_SECRET`
- `ELEVENLABS_API_KEY`

Variables operativas importantes:

- `INTERNAL_API_URL`
- `BACKEND_PUBLIC_URL`
- `TRUST_PROXY_HOPS`
- `ATTACHMENTS_DIR`
- `REDIS_URL`
- `HTTP_BODY_LIMIT`
- `PUBLIC_ATTACHMENT_DEFAULT_TTL_MINUTES`
- `EXPENSE_EXPORT_TTL_HOURS`

Reglas:

- No guardar secretos en Git.
- No pasar secretos como build args.
- No loguear valores.
- Rotar tras incidente, exposición o acceso no autorizado.

## 16. Frontend Y CSP

El frontend Next.js mantiene los controles principales de navegador:

- CSP con nonce y `strict-dynamic`.
- Sin `'unsafe-eval'` en producción.
- Headers de seguridad coherentes con la respuesta HTML.
- Sanitización previa a `dangerouslySetInnerHTML` para HTML de usuario.
- No usar `window.confirm`, `window.alert` ni `window.prompt` en flujos de producto; usar `ConfirmDialog`.

Regla de seguridad:

- No debilitar `script-src`, `connect-src` ni CSP sin justificación documentada.
- No bajar Next.js a versiones vulnerables; validar CVEs/release notes antes de cambios de versión.

## 17. Validación Local De Seguridad

De momento no se configura una pipeline obligatoria en GitHub ni en Coolify. La validación queda como control local/de desarrollo mediante:

```bash
./scripts/security-check.sh
```

Orden lógico del script:

1. Prisma Validate.
2. `npm audit` backend/frontend.
3. Unit Tests backend/frontend.
4. Build backend/frontend.

Trivy queda disponible como validación local opcional porque requiere Docker e instalación local de Trivy:

```bash
./scripts/security-check.sh --trivy
```

Con `--trivy`, el script además:

- Construye imagen Docker backend.
- Escanea imagen backend con Trivy bloqueando `HIGH` y `CRITICAL`.
- Construye imagen Docker frontend.
- Escanea imagen frontend con Trivy bloqueando `HIGH` y `CRITICAL`.

Política actual:

- Ejecutar la validación local antes de cambios sensibles, despliegues manuales o merges importantes.
- No hay bloqueo centralizado en GitHub Branch Protection.
- Coolify no ejecuta estos checks.
- Si el equipo crece o aumenta el ritmo de cambios, reabrir la decisión y mover estos checks a CI obligatoria.

## 18. Matriz De Controles

| Área | Control principal | Estado |
| --- | --- | --- |
| Auth | JWT global fail-closed + `@Public()` explícito | Aplicado |
| Alta usuarios | Invitaciones; registro público deshabilitado | Aplicado |
| Secrets | Fail-fast producción | Aplicado |
| CORS | Allowlist exacta | Aplicado |
| Errores | Filtro global + `requestId` | Aplicado |
| Uploads | Tamaño + MIME + magic bytes | Aplicado |
| Parsers | Procesos hijo con límites | Aplicado |
| IA | Timeouts + throttles + no prompts completos | Aplicado |
| KYC audit | `kyc_audit_logs` + UI admin | Aplicado |
| Webhooks | Secretos/HMAC + throttles | Aplicado |
| Public URLs | Token + TTL + controles por lote | Aplicado |
| Contenedores | Usuario no root + multi-stage | Aplicado |
| Validación local | Prisma, audit, tests, build; Trivy opcional | Aplicado |
| Runtime Docker | `read_only`, tmpfs, caps, límites | Pendiente entorno |
| Backups | Requiere política operativa y pruebas de restore | Pendiente entorno |

## 19. Checklist Para Cambios Futuros

Antes de añadir o modificar un flujo sensible:

```text
[ ] Endpoint autenticado por defecto o `@Public()` justificado
[ ] Ownership/rol/catálogo compartido documentado
[ ] DTOs de body/query/params
[ ] Respuesta sin campos internos innecesarios
[ ] Rate limit específico si es IA/upload/export/webhook
[ ] Logs sin secretos ni cuerpos sensibles
[ ] Tests de autorización positiva y negativa
[ ] Si hay ficheros: validación, rutas seguras y descarga segura
[ ] Si hay IA: timeout, límites y minimización de prompt/respuesta
[ ] Si hay worker: revalidar ownership dentro del job
[ ] Si hay migración: backup reciente confirmado
[ ] Si hay contenedor/despliegue: revisar baseline runtime
[ ] `./scripts/security-check.sh` pasa antes de mergear/desplegar cambios sensibles
```

## 20. Pendientes Aceptados O De Entorno

No bloquean la fase actual, pero deben mantenerse visibles:

- Revocación avanzada de JWT/sesiones.
- DTOs estrictos adicionales en algunos endpoints KYC que todavía aceptan `Record<string, unknown>`.
- DNS rebinding residual en descarga SSRF.
- Runtime hardening en Coolify: read-only, tmpfs `/tmp`, `cap_drop`, `no-new-privileges`, límites.
- Separación futura de workers BullMQ si crece el procesamiento.
- Política formal de backups/restores y evidencias periódicas.
- CI obligatoria, SBOM y publicación de resultados SARIF/Trivy en Security tab si el proceso deja de ser local/manual.
