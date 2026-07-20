# Baseline de seguridad para contenedores

Esta baseline aplica a los servicios Docker/Coolify de Avvale Companion App. Cualquier nuevo servicio debe revisarse contra esta lista antes de desplegarlo.

## Principios

- Usar imágenes oficiales con versión fijada. No usar `latest`.
- Separar build y runtime con multi-stage builds.
- Ejecutar aplicaciones como usuario no root.
- No introducir secretos en build args, Dockerfiles, labels ni filesystem de imagen.
- Mantener el runtime mínimo: solo código compilado, assets necesarios y dependencias de producción.
- No montar `/var/run/docker.sock` en contenedores de aplicación.
- No usar `privileged: true`, `network_mode: host`, `seccomp:unconfined` ni `apparmor:unconfined`.
- Publicar solo puertos que deban recibir tráfico desde Traefik o desde el host.
- Mantener base de datos, Redis, workers y almacenamiento en redes internas.

## Checklist mínima

```text
[ ] Imagen base fijada
[ ] Multi-stage build
[ ] Usuario no root
[ ] Sin secretos durante build
[ ] .dockerignore validado
[ ] Root filesystem read-only evaluado
[ ] /tmp en tmpfs
[ ] /tmp noexec evaluado
[ ] cap_drop ALL
[ ] no-new-privileges
[ ] Sin privileged
[ ] Sin Docker socket
[ ] Puertos mínimos
[ ] Red interna
[ ] Límites CPU/memoria
[ ] PIDs limitados
[ ] Healthcheck
[ ] Graceful shutdown
[ ] Logs rotados
[ ] Trivy ejecutado
[ ] Build y tests correctos
```

## Requisitos por servicio

### Frontend

- Debe ejecutarse como usuario no root.
- Debe servir únicamente el output standalone de Next.js.
- No debe incluir `.env`, `.git`, `node_modules` locales ni caches del host.
- Debe poder funcionar con filesystem read-only y `/tmp` tmpfs si Coolify lo permite.
- Solo debe estar expuesto a Traefik/Coolify por el puerto `3000`.

### Backend

- Debe ejecutarse como usuario no root.
- `ATTACHMENTS_DIR` debe apuntar a un volumen persistente con ownership compatible con el UID del contenedor.
- `/tmp` debe ser tmpfs con tamaño limitado para procesamiento temporal de documentos.
- El backend puede necesitar salida a internet para IA, SMTP, Make y otras integraciones externas.
- Redis y MySQL/MariaDB deben ser internos.
- Las migraciones Prisma deben ejecutarse de forma controlada; evitar múltiples réplicas ejecutándolas simultáneamente.

### Redis y base de datos

- No publicar puertos a internet.
- Usar red interna de Coolify o proveedor gestionado.
- Activar persistencia solo cuando sea necesaria.
- Aplicar backups y rotación fuera de la imagen de aplicación.

## Configuración recomendada en Coolify

Aplicar cuando la UI/modo de despliegue lo permita:

```yaml
read_only: true
tmpfs:
  - /tmp:rw,noexec,nosuid,nodev,size=256m
cap_drop:
  - ALL
security_opt:
  - no-new-privileges:true
pids_limit: 200
```

Valores iniciales conservadores a validar con tráfico real:

| Servicio | Memoria | CPU | PIDs | `/tmp` |
| -------- | ------- | --- | ---- | ------ |
| Frontend | 512 MB - 1 GB | 0.5 - 1.0 | 100 | 128 MB |
| Backend | 1 GB - 2 GB | 1.0 - 2.0 | 200 | 256 MB |
| Worker dedicado futuro | 1 GB - 2 GB | 1.0 - 2.0 | 200 | 512 MB |
| Redis | 256 MB - 512 MB | 0.25 - 0.5 | 100 | No aplica |

No aplicar límites sin smoke test de login, magic link, uploads, RFQ, gastos y healthchecks.

## Validaciones runtime

Tras construir y arrancar imágenes:

```bash
id
whoami
cat /proc/1/status | grep -E 'NoNewPrivs|CapEff'
mount
```

Comprobar:

- UID distinto de `0`.
- `NoNewPrivs: 1` si se aplicó `security_opt`.
- Capacidades efectivas vacías si se aplicó `cap_drop: ALL`.
- `/tmp` montado como tmpfs con `noexec,nosuid,nodev`.
- No existen `.env`, `.git`, logs, dumps ni evidencias dentro de la imagen.

## Migraciones

El backend mantiene `prisma migrate deploy` en el entrypoint por compatibilidad actual con Coolify. Si se escala a varias réplicas, mover migraciones a un job/comando manual:

```bash
cd backend
npm run prisma:migrate:deploy
```

Debe ejecutarse una sola vez por despliegue y con la misma `DATABASE_URL` del entorno objetivo.
