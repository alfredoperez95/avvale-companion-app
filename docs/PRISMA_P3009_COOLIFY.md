# Prisma P3009 en Coolify (migración fallida `user_anthropic_credentials`)

## Qué significa

`Error: P3009` indica que en la tabla `_prisma_migrations` hay una migración marcada como **fallida**. Prisma **no aplica migraciones nuevas** hasta que eso se corrige. El `entrypoint` del backend ejecuta `npx prisma migrate deploy`; si falla, el proceso termina, **Nest no arranca** y el healthcheck (`GET http://127.0.0.1:4000/health`) falla.

La migración afectada suele ser:

`20260402090000_user_anthropic_credentials`

## Antes de tocar producción

- Haz **backup** de la base de datos (dump MySQL).
- Ejecuta los comandos con la misma **`DATABASE_URL`** que usa el contenedor en Coolify.

## 1. Comprobar el estado real de la BD

Conéctate a MySQL (cliente, Coolify “Execute command” en el servicio DB, o `mysql` desde un contenedor con red al servicio).

```sql
-- ¿Existe la tabla?
SHOW TABLES LIKE 'user_anthropic_credentials';

-- Si existe, revisa columnas (debe alinear con prisma/schema: user_anthropic_credentials)
SHOW CREATE TABLE user_anthropic_credentials;

-- Estado de la migración en Prisma
SELECT migration_name, finished_at, rolled_back_at, logs
FROM _prisma_migrations
WHERE migration_name = '20260402090000_user_anthropic_credentials';
```

## 2. Elegir una resolución

### Caso A — La tabla **existe** y el esquema es correcto

La migración falló *después* de crear la tabla (o ya estaba aplicada). Marca la migración como aplicada **sin volver a ejecutar el SQL**:

Desde una máquina con el repo `backend/` y `DATABASE_URL` apuntando a producción:

```bash
cd backend
npx prisma migrate resolve --applied 20260402090000_user_anthropic_credentials
```

### Caso B — La tabla **no existe**

La migración no llegó a completarse o se revirtió. Marca como revertida para que `migrate deploy` pueda **intentarla de nuevo**:

```bash
cd backend
npx prisma migrate resolve --rolled-back 20260402090000_user_anthropic_credentials
npx prisma migrate deploy
```

Luego vuelve a desplegar en Coolify (o deja que el entrypoint ejecute `migrate deploy`).

### Caso C — La tabla existe **a medias** o con errores

No uses `--applied` a ciegas. Corrige el esquema manualmente (o elimina la tabla vacía si no hay datos que conservar) hasta que coincida con `UserAnthropicCredential` en `prisma/schema.prisma`, y entonces usa **Caso A** o **B** según corresponda.

## 3. Verificar y redesplegar

1. `npx prisma migrate deploy` debe terminar sin P3009.
2. Arranca el backend (o redeploy en Coolify): debe responder `GET /health` (sin prefijo `/api`; health está excluido del prefijo global en Nest).

## Nota sobre el aviso de Coolify (curl/wget)

La imagen `backend/Dockerfile` ya instala `curl` y `wget` en la etapa final. Si Coolify sigue mostrando la advertencia genérica, puedes ignorarla si el healthcheck usa una URL que el proceso realmente sirve; el fallo que ves en los logs viene de **Prisma**, no del curl.

## Referencia

- [Prisma: Resolving migration issues in production](https://www.prisma.io/docs/guides/migrate/production-troubleshooting)
