# Inventario de seguridad de contenedores

Fecha: 2026-07-20

Este inventario refleja el estado observado en el repositorio. La configuración real de Coolify/Traefik no está versionada aquí, por lo que los controles runtime gestionados desde Coolify quedan marcados como "no definido en repo" cuando no aparecen en Dockerfile o Compose.

## Servicios e imágenes

| Servicio | Imagen base | Usuario | Puerto | Volúmenes | Red | Read-only | Capabilities | Healthcheck | Riesgo |
| -------- | ----------- | ------- | ------ | --------- | --- | --------- | ------------ | ----------- | ------ |
| Frontend Next.js | `node:22-alpine` | `nextjs` UID 1001 | `3000` (`EXPOSE`) | No definido en repo | Coolify/Traefik no versionado | No definido | No definido | Docker `HEALTHCHECK` con Node contra `/` | Público, RCE previa en superficie Next, sin límites runtime versionados |
| Backend NestJS | `node:22-alpine` | `app` UID 1001 | `4000` (`EXPOSE`) | Requiere `ATTACHMENTS_DIR` persistente; no definido en repo | Coolify/Traefik no versionado | No definido | No definido | Docker `HEALTHCHECK` con Node contra `/health/live` | API pública/interna, uploads, IA, workers BullMQ en proceso, migraciones al arranque |
| Redis desarrollo | `redis:7-alpine` | Usuario de imagen oficial | `6379:6379` publicado en `backend/docker-compose.dev.yml` | `avvale-redis-data:/data` | Compose dev por defecto | No definido | No definido | No definido | Solo dev; si se replica en prod publicaría Redis indebidamente |
| Base de datos MySQL/MariaDB | No definido en repo | Gestionado por Coolify/proveedor | No definido | Persistente en Coolify/proveedor | Interna esperada | No aplica | No aplica | No definido en repo | Debe permanecer interna; el contexto del prompt menciona PostgreSQL, pero Prisma usa `provider = "mysql"` |
| Workers BullMQ | Misma imagen/proceso backend | Hereda backend (`root` actual) | Sin puerto dedicado | Requiere Redis y acceso a uploads | Interna esperada | No definido | No definido | No definido | Procesamiento de RFQ/gastos/activaciones comparte recursos con API |
| Worker Excel aislado | Proceso hijo Node dentro del backend | Hereda backend (`root` actual) | Sin puerto | Usa `/tmp` para buffers temporales y lee archivos en `ATTACHMENTS_DIR` | Interna al proceso | Hereda backend | Hereda backend | Timeout interno 15s, sin healthcheck Docker | Parsing de documentos no confiables; memoria Node limitada a 128 MB por proceso hijo |
| Dockerfile raíz PHP/Apache | `php:8.2-apache` | `root`/Apache según imagen | `80` (`EXPOSE`) | Copia repo completo | No definido | No definido | No definido | No definido | No forma parte del flujo Node documentado; riesgo alto si Coolify lo usa por error |

## Archivos revisados

| Archivo | Uso observado | Observaciones |
| ------- | ------------- | ------------- |
| `frontend/Dockerfile` | Imagen de producción Next.js standalone | Multi-stage, usuario no root, copia standalone; conserva `wget` mínimo de BusyBox por healthcheck Coolify; `HEALTHCHECK` con Node; sin controles runtime |
| `backend/Dockerfile` | Imagen de producción NestJS | Multi-stage, runtime con `npm ci --omit=dev`, usuario no root, conserva `wget` mínimo de BusyBox por healthcheck Coolify, `HEALTHCHECK` con Node; ejecuta migraciones en entrypoint |
| `Dockerfile` | Dockerfile raíz PHP/Apache | Documentado en `README.md` como no operativo para Nest/Next; copia todo el repo con `COPY . /var/www/html/` |
| `backend/docker-compose.dev.yml` | Redis local de desarrollo | Publica `6379:6379`; aceptable en dev local, no apto como plantilla prod sin ajustes |
| `backend/.dockerignore` | Build context backend | Excluye `.env`, `.git`, IDE, logs, coverage, backups, dumps, uploads, evidencias y temporales |
| `.dockerignore` raíz | Build context raíz accidental | Excluye `.env`, `.git`, IDE, build outputs, logs, backups, dumps, uploads, evidencias y documentos de review |
| `frontend/.dockerignore` | Build context frontend | Excluye `.env`, `.git`, IDE, build outputs, logs, backups, dumps, evidencias y temporales |

## Escritura necesaria

| Servicio | Necesita escritura | Directorios recomendados |
| -------- | ------------------ | ------------------------ |
| Frontend | Baja. Next standalone debería poder correr con filesystem read-only si no se usan caches runtime persistentes | `/tmp` como tmpfs pequeño si Node/Next lo requiere |
| Backend | Alta. Guarda adjuntos, gastos, RFQ, avatares y exports | `ATTACHMENTS_DIR` como volumen persistente con permisos del usuario app; `/tmp` como tmpfs para Excel/parser temporales |
| Redis dev/prod | Sí, persistencia opcional | `/data` como volumen persistente si se requiere AOF |
| Base de datos | Sí | Volumen/proveedor gestionado fuera del repo |
| Worker Excel | Temporal | `/tmp` con `noexec,nosuid,nodev,size=256m` si el runtime lo soporta |

## Comunicación requerida

| Origen | Destino | Motivo | Debe ser público |
| ------ | ------- | ------ | ---------------- |
| Traefik | Frontend | Tráfico web público | Sí |
| Traefik o Frontend server-side | Backend | API Nest y rewrites `/api/*` | Según arquitectura; puede ser interno detrás de Traefik |
| Backend | MySQL/MariaDB | Prisma | No |
| Backend | Redis | BullMQ | No |
| Backend | APIs externas | IA, Make, SMTP, Google News/RSS, webhooks salientes | Salida a internet sí, entrada no |
| Workers en backend | Redis/Base de datos/uploads | Procesamiento asíncrono | No |

## Compatibilidad preliminar

| Control | Frontend | Backend | Riesgo de compatibilidad |
| ------- | -------- | ------- | ------------------------ |
| Usuario no root | Ya aplicado | Aplicado en imagen; requiere permisos en `ATTACHMENTS_DIR` de Coolify | Medio |
| `read_only: true` | Probablemente compatible con `/tmp` tmpfs | Compatible solo con volumen explícito para `ATTACHMENTS_DIR` y `/tmp` tmpfs | Medio |
| `/tmp: noexec` | Probablemente compatible | Probablemente compatible: el worker Excel escribe datos en `/tmp` pero ejecuta `node`/worker desde `dist` | Bajo/medio |
| `cap_drop: [ALL]` | Probablemente compatible | Probablemente compatible | Bajo |
| `no-new-privileges:true` | Probablemente compatible | Probablemente compatible | Bajo |
| Límites CPU/mem/PIDs | Recomendado | Recomendado con margen por IA/uploads/Excel | Medio |
| Separar workers | No aplica | Recomendable a futuro; hoy processors y API comparten proceso | Medio/alto si se cambia ahora |

## Puertos

| Puerto | Servicio | Estado repo | Recomendación |
| ------ | -------- | ----------- | ------------- |
| `3000` | Frontend | `EXPOSE 3000` | Mantener accesible solo por red Traefik/Coolify, no publicar host si Traefik enruta por red Docker |
| `4000` | Backend | `EXPOSE 4000` | Mantener interno o accesible solo por Traefik; no publicar directamente a internet salvo diseño explícito |
| `6379` | Redis dev | `ports: "6379:6379"` en Compose dev | Solo desarrollo local; en Coolify/prod usar red interna sin puerto público |
| `80` | Dockerfile raíz PHP | `EXPOSE 80` | No usar para esta app; eliminar o aislar para evitar despliegue accidental |
