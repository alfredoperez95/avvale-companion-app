# Baseline de seguridad backend

Este baseline aplica a todo cambio futuro en el backend NestJS de Avvale Companion.

## Reglas permanentes

- Todo endpoint debe declarar si es público con `@Public()`; el modelo por defecto es autenticado.
- Los endpoints autenticados deben validar autorización además de autenticación: owner, rol, tenant/organización o catálogo compartido documentado.
- Un catálogo compartido solo es aceptable si está documentado como decisión funcional explícita, indicando quién puede leer, quién puede modificar, qué datos contiene y qué evento obligaría a reabrir el modelo de autorización.
- Los catálogos compartidos modificables deben mantener auditoría de cambios con actor, acción, entidad y metadatos minimizados; no guardar prompts, documentos completos ni textos largos en el log.
- Todo body, query y params debe usar DTO con `class-validator` cuando acepte entrada de usuario.
- No pasar DTOs completos a Prisma si contienen campos no editables por el usuario.
- Todo endpoint de IA, upload, exportación o procesamiento costoso debe tener rate limit específico.
- No registrar secretos, tokens, cookies, API keys, prompts sensibles ni cuerpos de documentos.
- Los errores de API deben pasar por el filtro global y devolver `requestId`.
- Las respuestas deben usar `select` o mappers cuando exista riesgo de exponer campos internos.
- Los uploads se validan en backend con allowlist, tamaño, MIME y magic bytes.
- El procesamiento de ficheros complejos no confiables (PDF, Office, Excel, HEIC/HEIF, EML u otros parsers nativos/pesados) debe ejecutarse fuera del proceso Nest principal, con timeout, límite de memoria y limpieza de temporales.
- Ningún endpoint debe descargar URLs de usuario sin controles SSRF.
- Swagger, si se añade, debe estar deshabilitado en producción o protegido.
- Los healthchecks deben separar vida del proceso y disponibilidad de dependencias.
- No introducir `window.confirm`, `window.alert` ni `window.prompt` en flujos de producto.

## Checklist para nuevos endpoints

```text
[ ] Autenticación definida
[ ] Autorización definida
[ ] Ownership/tenant verificado o catálogo compartido documentado
[ ] DTO de body
[ ] DTO de query
[ ] DTO de params
[ ] Rate limit evaluado
[ ] Logging sanitizado
[ ] Errores controlados
[ ] Datos de respuesta limitados
[ ] Tests de seguridad
[ ] OpenAPI revisado
```

## Checklist adicional para IA

```text
[ ] Límite de longitud de prompt/mensaje
[ ] Límite de número de ficheros/contexto
[ ] `max_tokens` definido
[ ] Timeout explícito
[ ] Rate limit específico
[ ] No se envían secretos al modelo
[ ] Contenido externo marcado como no confiable
[ ] Argumentos de herramientas validados por esquema si existen
```

## Checklist adicional para uploads

```text
[ ] Límite Multer o equivalente antes de cargar en memoria
[ ] Allowlist de extensiones
[ ] MIME declarado validado
[ ] Magic bytes validados
[ ] Nombre interno aleatorio
[ ] Path traversal bloqueado
[ ] Ejecutables/SVG/HTML/JS bloqueados salvo excepción aprobada
[ ] Descarga autorizada o token público con expiración
[ ] `X-Content-Type-Options: nosniff`
[ ] Parsers/conversores complejos aislados en worker o cola dedicada
[ ] Timeout, límite de memoria y truncado de salida definidos para extracción de texto
[ ] Preparado para antivirus/estado de escaneo si el flujo lo requiere
```

## Variables críticas

En producción el arranque debe fallar si faltan o son débiles:

- `DATABASE_URL`
- `JWT_SECRET`
- `MAGIC_LINK_SECRET` o secreto fuerte equivalente
- `INVITE_TOKEN_SECRET` o secreto fuerte equivalente
- `CORS_ORIGIN`

También debe fallar si `MAIL_SKIP_SEND=true`.

## CORS y proxy

- `CORS_ORIGIN` debe contener orígenes exactos separados por coma.
- No usar `origin: '*'` con credenciales.
- `TRUST_PROXY_HOPS` debe configurarse según Coolify/Traefik. El valor por defecto del backend confía en proxy local (`loopback`).

## Estados de hallazgos

- `OPEN`: detectado y pendiente.
- `IN PROGRESS`: remediación en curso.
- `MITIGATED`: corregido por código/configuración.
- `ACCEPTED`: aceptado por decisión de producto/negocio.
- `NOT APPLICABLE`: no aplica al diseño actual.
