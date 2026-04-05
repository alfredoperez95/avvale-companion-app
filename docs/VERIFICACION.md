# Verificación del estado del proyecto

Comprueba que backend, frontend y base de datos están correctamente configurados.

**Inicio de sesión (ruta canónica, flujo por defecto y redirecciones):** `docs/LOGIN_STANDARD.md`.

## 1. Backend arranca con las variables actuales

Desde la raíz del proyecto:

```bash
cd backend
npm run start:dev
```

Debe aparecer en consola:

- `Backend running at http://localhost:4000`
- `CORS allowed origins: http://localhost:3000` (o los valores de tu `CORS_ORIGIN`, separados por coma)

Si falla por variables, revisa que exista `backend/.env` con `DATABASE_URL`, `JWT_SECRET` y `CORS_ORIGIN`. El tiempo máximo de sesión lo fija `JWT_EXPIRES_IN` (por defecto en código `5d` si no la defines); detalle en `docs/LOGIN_STANDARD.md`.

---

## 2. Prisma conectado (DATABASE_URL)

Con el backend en marcha, en otra terminal:

```bash
curl -s http://localhost:4000/health
```

Respuesta esperada:

```json
{"status":"ok","database":"connected"}
```

Si ves `"database":"disconnected"`, la `DATABASE_URL` en `backend/.env` es incorrecta o la base no es accesible (firewall, host, usuario, contraseña).

---

## 3. Endpoints de autenticación

**Registro:**

```bash
curl -s -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@ejemplo.com","password":"minimo6","name":"Test"}'
```

Debe devolver JSON con `accessToken` y `user` (id, email).

**Login:**

```bash
curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@ejemplo.com","password":"minimo6"}'
```

Misma forma: `accessToken` y `user`.

**Me (con token):**

```bash
# Sustituye TOKEN por el accessToken del login
curl -s http://localhost:4000/auth/me -H "Authorization: Bearer TOKEN"
```

Debe devolver los datos del usuario (sin contraseña).

---

## 4. Frontend usa NEXT_PUBLIC_API_URL

- El frontend llama al backend con `process.env.NEXT_PUBLIC_API_URL` (en `src/lib/api.ts`, login y dashboard).
- Debe existir `frontend/.env` con `NEXT_PUBLIC_API_URL=http://localhost:4000` para desarrollo local.
- Si cambias la variable, reinicia el servidor de Next (`npm run dev`), porque las variables `NEXT_PUBLIC_*` se inyectan al arrancar.

---

## 5. Login y dashboard operativos

1. Backend en marcha en el puerto 4000.
2. Frontend en marcha: `cd frontend && npm run dev` (puerto 3000).
3. Navegador: http://localhost:3000
4. Clic en "Iniciar sesión", usar un email/contraseña registrados (por ejemplo con el `curl` de registro de arriba).
5. Tras el login debes llegar al dashboard con tu email visible y el tile "Mis activaciones".
6. Clic en "Mis activaciones": debe cargar la lista (vacía si no hay activaciones) sin redirigir a login si el token es válido.

---

## 6. Flujo base estable

| Paso | Comprobación |
|------|--------------|
| Variables | `.env` en raíz, `backend/.env` y `frontend/.env` (por ejemplo con `./scripts/prepare-env.sh`). |
| DB | `curl http://localhost:4000/health` → `database: "connected"`. (En el navegador vía Next suele ser `/api/health` por el rewrite.) |
| Auth | Registro y login por API devuelven `accessToken`. |
| Frontend | Login en la web guarda token y redirige al dashboard. |
| Protegido | Dashboard y `/activations` usan el token; si no hay token o es inválido, redirigen a login. |
| API protegida | `GET /activations` (Nest directo) o `GET /api/activations` (vía Next) sin token → 401. Con token → lista (solo del usuario). |

Si todo lo anterior se cumple, el flujo base está listo para seguir construyendo (nueva activación, envío vía Make, etc.).

---

## 7. Checklist producción (dominio público HTTPS)

Entorno de referencia: **[https://www.avvalecompanion.app/](https://www.avvalecompanion.app/)** (Coolify). Ajusta los valores si usáis otro dominio.

| Comprobación | Notas |
|--------------|--------|
| **`CORS_ORIGIN`** | Debe incluir el origen exacto del navegador, p. ej. `https://www.avvalecompanion.app` y, si aplica, `https://avvalecompanion.app` (varios en una línea separados por coma). |
| **`NEXT_PUBLIC_API_URL`** | Build del frontend: mismo origen público si el proxy enruta `/api/*` al Nest; revisad también `NEXT_PUBLIC_API_STRIP_PREFIX` según [README](../README.md) (sección Docker / login en PRO). |
| **`BACKEND_PUBLIC_URL`** | Opcional si coincide con la base usada para adjuntos; si no, definidla para que `attachments[].url` en Make apunte a URLs HTTPS válidas (ver [MAKE.md](MAKE.md)). |
| **Callback Make** | Escenario: `POST https://www.avvalecompanion.app/api/webhooks/make/callback` (o vuestro host real), cuerpo con `MAKE_CALLBACK_SECRET`. |
| **DNS / certificado** | `www` y apex coherentes (redirect 301 o ambos servidos); evita mezclar HTTP y HTTPS en el mismo flujo de login. |

---

## 8. Login por enlace mágico y correo `no-reply`

1. **Variables** (raíz `.env` → `prepare-env.sh`, o **Coolify en el contenedor del backend**): `MAIL_FROM`, `SMTP_*`, `MAGIC_LINK_BASE_URL` (URL **HTTPS** pública del front, terminando en `/login/magic`, sin `?token`). En local sin SMTP: `MAIL_SKIP_SEND=true` (el enlace se registra en el log del backend). **En producción:** `MAIL_SKIP_SEND` debe ser **`false` o no definida**; si es `true`, **no se envía** correo (solo log `[MAIL_SKIP_SEND]`). No dupliques `MAIL_SKIP_SEND` en el mismo `.env`. Solo hace falta **SMTP** (envío); **IMAP** es para leer correo en un cliente, no para esta aplicación.
2. **Si “no llega el correo” pero la UI muestra éxito:** el endpoint siempre responde 200 (anti enumeración). Revisa **logs del Nest**: `Correo enlace mágico enviado` (OK), `SMTP sendMail falló` o `Enlace mágico no enviado` (credenciales / firewall saliente al SMTP), o `[MAIL_SKIP_SEND]` (envío desactivado).
3. **DNS**: SPF/DKIM/DMARC para el dominio del remitente (p. ej. `no-reply@avvalecompanion.app`) según el proveedor SMTP/API.
4. **IONOS (referencia)**: salida `smtp.ionos.es`, puerto **587**, TLS (en `nodemailer`: `SMTP_SECURE=false` con puerto 587). Usuario/contraseña del buzón que envía (suele ser el email completo).
5. **Flujo**: en `/login`, «Enviar enlace de acceso» llama a `POST /api/auth/magic-link/request` (misma respuesta genérica siempre). El correo incluye un enlace a `/login/magic?token=…` que canjea `POST /api/auth/magic-link/verify` y guarda el JWT como el login normal.
6. **Rate limit**: máximo 5 solicitudes de enlace por minuto e IP (aprox.) en `magic-link/request`.
