# Security Review Containers

Fecha: 2026-07-20

## Resumen ejecutivo

La Fase 3 queda iniciada con inventario y auditoría documental de Docker/contendores. No se han aplicado cambios estructurales a Dockerfiles, Compose ni Coolify en este paso.

El riesgo principal observado era que el backend de producción se ejecutaba como `root` implícito y copiaba al runtime dependencias completas instaladas con `npm ci`, incluyendo dependencias de desarrollo. Ambos puntos quedan mitigados en el repo: el backend ahora usa usuario `app` UID 1001 y una etapa de dependencias productivas con `npm ci --omit=dev`.

El frontend ya utilizaba usuario no root y salida standalone de Next.js; además se han retirado `curl/wget` del runtime y añadido healthcheck Docker con Node.

Siguen pendientes los controles que dependen de runtime/Coolify: `read_only`, tmpfs `/tmp` con `noexec`, `cap_drop`, `no-new-privileges`, límites de CPU/mem/PIDs, redes internas y rotación de logs.

## Alcance

Revisado:

- `frontend/Dockerfile`
- `backend/Dockerfile`
- `Dockerfile` raíz
- `backend/docker-compose.dev.yml`
- `backend/.dockerignore`
- Scripts de arranque y migración del backend
- Configuración de healthchecks HTTP en NestJS
- Uso de uploads, `/tmp`, BullMQ, Redis, Prisma y worker de Excel
- Documentación de despliegue en `README.md`

Fuera de alcance observado:

- Configuración real de Coolify.
- Labels dinámicas de Traefik gestionadas por Coolify.
- Volúmenes reales creados en el servidor.
- Redes Docker reales de producción.
- Límites runtime aplicados desde UI de Coolify.
- Escaneo Trivy real de imágenes construidas.

## Arquitectura actual observada

- Frontend: Next.js 15.5.20, `frontend/Dockerfile`, `node:22-alpine`, output standalone, usuario `nextjs`.
- Backend: NestJS 11, `backend/Dockerfile`, `node:22-alpine`, Prisma y BullMQ en el mismo proceso.
- Base de datos: Prisma declara `provider = "mysql"`; la documentación del repo habla de MySQL/MariaDB. El contexto inicial menciona PostgreSQL, pero no coincide con el repositorio.
- Redis: solo hay `backend/docker-compose.dev.yml` para desarrollo. Producción/Coolify debe usar servicio Redis interno o proveedor gestionado.
- Workers: processors BullMQ y API comparten proceso en v1. El worker de Excel es un proceso hijo de Node lanzado desde el backend, con timeout y límite de memoria V8.

Inventario detallado: `docs/CONTAINER_SECURITY_INVENTORY.md`.

## Hallazgos

| ID | Severidad | Hallazgo | Servicio | Impacto | Recomendación | Estado |
| -- | --------- | -------- | -------- | ------- | ------------- | ------ |
| C-01 | Critical | Backend ejecuta como `root` implícito | Backend | Una RCE tendría permisos UID 0 dentro del contenedor | Crear usuario/grupo app no root, ajustar ownership de `dist`, `node_modules`, `prisma`, `entrypoint.sh` y volumen `ATTACHMENTS_DIR` | MITIGATED |
| C-02 | High | Runtime backend contiene dependencias de desarrollo | Backend | Mayor superficie vulnerable y herramientas innecesarias en producción | Separar etapa prod-deps con `npm ci --omit=dev` tras `prisma generate/build`, copiando solo deps productivas necesarias | MITIGATED |
| C-03 | High | Dockerfile raíz PHP/Apache copiaba el repo completo | Root Dockerfile | Despliegue accidental por Coolify podía publicar código, docs o ficheros sensibles y usar una imagen ajena al stack | Eliminado tras comprobar que no pertenece a la arquitectura actual y no hay referencias versionadas de uso | MITIGATED |
| C-04 | High | No existe `.dockerignore` raíz ni `frontend/.dockerignore` | Frontend / raíz | Build context amplio; riesgo de incluir `.env`, `.git`, logs, backups o evidencias si se construye desde esos contextos | Añadir `.dockerignore` en raíz y frontend; ampliar backend `.dockerignore` | MITIGATED |
| C-05 | High | No hay controles runtime versionados: `read_only`, `cap_drop`, `no-new-privileges`, `pids_limit` | Frontend / Backend | Una RCE puede escribir en filesystem completo, conservar herramientas temporales o abusar de recursos | Documentar/aplicar en Coolify o Compose compatible: `read_only`, tmpfs, `cap_drop: ALL`, `security_opt`, límites CPU/mem/PIDs | OPEN |
| C-06 | High | `/tmp` no está declarado como tmpfs `noexec,nosuid,nodev` | Frontend / Backend | Repite el patrón del incidente previo, donde el payload se ejecutó desde `/tmp` | Configurar tmpfs `/tmp:rw,noexec,nosuid,nodev,size=256m`; validar Excel/Node/Next antes de producción | OPEN |
| C-07 | High | No hay límites de CPU/memoria/PIDs documentados | Frontend / Backend / workers | Minería, fork bomb o fugas de memoria pueden degradar el host compartido | Definir límites iniciales conservadores en Coolify; separar worker si el consumo de documentos crece | OPEN |
| C-08 | Medium | Runtime frontend instala `curl` y `wget` | Frontend | Herramientas útiles para post-explotación y movimiento lateral HTTP | Evitar instalarlas si el healthcheck usa Node; si Coolify las requiere, documentar excepción | MITIGATED |
| C-09 | Medium | Runtime backend instala `curl` y `wget` | Backend | Herramientas útiles para post-explotación | Reemplazar healthcheck por script Node o mantener solo si Coolify lo exige y documentar | MITIGATED |
| C-10 | Medium | No hay `HEALTHCHECK` Docker en imágenes | Frontend / Backend | Coolify puede depender de checks externos; menor portabilidad y señal de readiness menos explícita | Añadir healthchecks con Node sin credenciales: frontend `/`, backend `/health/live` o `/health/ready` según caso | MITIGATED |
| C-11 | Medium | Backend ejecuta `npx prisma migrate deploy` en cada arranque | Backend | En múltiples réplicas puede haber carreras; falla el arranque si hay migración fallida | Mantener solo si Coolify usa una réplica; preferir comando manual/job de migración documentado | OPEN |
| C-12 | Medium | Workers BullMQ comparten proceso y recursos con la API | Backend | Procesamiento pesado de RFQ/gastos puede competir con tráfico web | Recomendar contenedor worker separado con mismo build y comando dedicado, sin aplicarlo aún | OPEN |
| C-13 | Medium | `app.enableShutdownHooks()` no aparece en bootstrap | Backend | SIGTERM puede cerrar sin ciclo graceful completo de Nest/Prisma/colas | Añadir shutdown hooks y revisar cierre de BullMQ/Prisma si no existe en servicios | MITIGATED |
| C-14 | Medium | Redis dev publica `6379:6379` | Redis dev | Aceptable localmente; peligroso si se reutiliza como prod | Marcar explícitamente como dev-only; en Coolify usar red interna sin puerto público | ACCEPTED |
| C-15 | Medium | No hay rotación de logs Docker versionada | Todos | Logs `json-file` pueden crecer sin límite si Coolify/daemon no lo controla | Configurar en Coolify/daemon o Compose `max-size`/`max-file`; no incluir secretos | OPEN |
| C-16 | Low | Seccomp/AppArmor no están personalizados en repo | Todos | Se usa comportamiento por defecto de Docker/Coolify | Mantener seccomp default; no usar perfiles `unconfined`; valorar AppArmor futuro | ACCEPTED |
| C-17 | Informational | No se encontraron `privileged: true`, `network_mode: host`, `cap_add` ni montaje de Docker socket | Todos | Reduce riesgo crítico inmediato | Mantener prohibición como baseline | MITIGATED |

## Incompatibilidades potenciales

### Usuario no root

- Frontend: ya validado a nivel Dockerfile con usuario `nextjs`.
- Backend: requiere cambio. Hay que garantizar que el usuario app pueda leer `dist`, `node_modules`, `prisma` y ejecutar `entrypoint.sh`; además debe escribir en `ATTACHMENTS_DIR`.
- Riesgo Coolify: si el volumen persistente de uploads fue creado por root, puede requerir ajuste manual de ownership/UID en el servidor o recreación controlada del volumen. No usar `chmod 777`.

### Root filesystem read-only

- Frontend: probable compatibilidad alta si Next standalone no necesita cache runtime persistente. Se recomienda `tmpfs /tmp`.
- Backend: viable solo con volumen explícito para `ATTACHMENTS_DIR` y tmpfs para `/tmp`.
- Prisma Client no debería necesitar escritura runtime fuera de logs/tmp, pero las migraciones sí requieren acceso a DB y lectura de `prisma/migrations`.

### `/tmp noexec`

- El incidente previo usó `/tmp/cheddar`. El objetivo es impedir ejecución desde `/tmp`.
- El worker de Excel escribe el buffer en `/tmp`, pero ejecuta `node` y el worker desde `dist`, por lo que `noexec` parece compatible.
- Debe validarse con RFQ, MEDDPICC y gastos antes de aplicar en producción.

### Coolify

- Coolify puede no exponer todas las opciones Docker Compose de forma directa según modo de despliegue.
- Si no permite `read_only`, `cap_drop`, `security_opt` o tmpfs desde UI, documentar el control como requisito operativo/manual.
- No modificar dominios, labels, redes reales ni secretos desde Cursor.

## Recomendaciones iniciales por bloque

### Bloque A - Crítico

1. Convertir backend a usuario no root. Estado: mitigado en Dockerfile; pendiente validar ownership del volumen `ATTACHMENTS_DIR` en Coolify.
2. Eliminar o neutralizar el Dockerfile raíz PHP/Apache para evitar despliegue accidental. Estado: mitigado; se eliminaron el `Dockerfile` raíz y `index.php` legacy.
3. Añadir `.dockerignore` raíz y frontend; ampliar backend `.dockerignore`.
4. Verificar que Coolify no monta Docker socket, no usa `privileged` y no publica DB/Redis.

### Bloque B - Alto

1. Reducir runtime backend a dependencias productivas. Estado: mitigado.
2. Quitar `curl/wget` o justificar su permanencia por healthcheck de Coolify. Estado: mitigado.
3. Añadir healthchecks Docker con Node. Estado: mitigado.
4. Preparar configuración Coolify para `read_only`, `/tmp` tmpfs, `cap_drop`, `no-new-privileges`, límites de CPU/mem/PIDs.

### Bloque C - Medio

1. Documentar Trivy/SBOM/CI.
2. Añadir baseline de seguridad para contenedores.
3. Revisar separación futura de workers.
4. Documentar rotación de logs y Docker Bench for Security.

## Comandos de validación propuestos

Ejecutados:

```bash
docker build -t avvale-backend:security-check ./backend
docker build -t avvale-frontend:security-check ./frontend
docker run --rm avvale-backend:security-check id
docker run --rm avvale-frontend:security-check id
```

Pendientes porque Trivy no está instalado localmente:

```bash
trivy image avvale-backend:security-check
trivy image avvale-frontend:security-check
trivy config .
trivy fs .
```

Resultados:

- Backend local: `npm audit`, `npm test`, `npm run build` OK.
- Frontend local: `npm audit`, `npm test`, `npm run build` OK.
- Docker backend: build OK; usuario final `uid=1001(app) gid=1001(app)`.
- Docker frontend: build OK; usuario final `uid=1001(nextjs) gid=1001(nodejs)`.
- `curl`/`wget` no quedan disponibles como comandos en PATH en las imágenes finales.
- Healthchecks Docker declarados en backend y frontend.
- Trivy: no ejecutado, herramienta no disponible localmente.

## Cambios legacy eliminados

Se eliminaron el `Dockerfile` raíz PHP/Apache y su `index.php` asociado. La comprobación local no encontró referencias desde Compose, scripts, workflows, package.json, Makefile ni archivos `coolify*`; la configuración externa real de Coolify no es accesible desde el repositorio, por lo que se asume el repositorio como fuente de verdad.

## Estado

Inventario, revisión inicial y primer bloque de correcciones completados. Builds Docker validados. Pendiente escaneo Trivy y aplicar en Coolify los controles runtime que no se pueden garantizar solo desde Dockerfile.
