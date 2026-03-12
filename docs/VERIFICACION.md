# Verificación del estado del proyecto

Comprueba que backend, frontend y base de datos están correctamente configurados.

## 1. Backend arranca con las variables actuales

Desde la raíz del proyecto:

```bash
cd backend
npm run start:dev
```

Debe aparecer en consola:

- `Backend running at http://localhost:4000/api`
- `CORS allowed origin: http://localhost:3000` (o el valor de tu `CORS_ORIGIN`)

Si falla por variables, revisa que exista `backend/.env` con `DATABASE_URL`, `JWT_SECRET` y `CORS_ORIGIN`.

---

## 2. Prisma conectado (DATABASE_URL)

Con el backend en marcha, en otra terminal:

```bash
curl -s http://localhost:4000/api/health
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
curl -s -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@ejemplo.com","password":"minimo6","name":"Test"}'
```

Debe devolver JSON con `accessToken` y `user` (id, email).

**Login:**

```bash
curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@ejemplo.com","password":"minimo6"}'
```

Misma forma: `accessToken` y `user`.

**Me (con token):**

```bash
# Sustituye TOKEN por el accessToken del login
curl -s http://localhost:4000/api/auth/me -H "Authorization: Bearer TOKEN"
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
| DB | `curl http://localhost:4000/api/health` → `database: "connected"`. |
| Auth | Registro y login por API devuelven `accessToken`. |
| Frontend | Login en la web guarda token y redirige al dashboard. |
| Protegido | Dashboard y `/activations` usan el token; si no hay token o es inválido, redirigen a login. |
| API protegida | `GET /api/activations` sin token → 401. Con token → lista (solo del usuario). |

Si todo lo anterior se cumple, el flujo base está listo para seguir construyendo (nueva activación, envío vía Make, etc.).
