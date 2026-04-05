# Estándar: inicio de sesión como entrada única

## Objetivo

Que **el inicio de sesión prevalezca** como única forma de acceder sin autenticar: una sola ruta, un flujo por defecto claro y redirecciones coherentes en front y documentación.

## Rutas canónicas (frontend)

| Ruta | Uso |
|------|-----|
| `/login` | Pantalla de acceso (única entrada pública acordada). |
| `/login/magic` | Canje del token enviado por correo (`?token=…`). |

No introducir rutas alternativas de “login” (`/sign-in`, `/auth`, etc.) sin acordarlo y actualizar este documento.

En código, usar siempre **`LOGIN_PATH`**, **`LOGIN_MAGIC_PATH`** y **`redirectToLogin()`** desde `@/lib/api` (reexportados desde `frontend/src/lib/auth-routes.ts`). Evita cadenas sueltas `'/login'` en redirecciones.

## Comportamiento UX por defecto

1. **Acceso recomendado:** enlace mágico al correo corporativo (`nombre.apellido@avvale.com`).
2. **Acceso alternativo:** contraseña, tras el enlace “¿Quieres acceder con contraseña?”.
3. **Raíz `/`:** redirige a `/launcher` si hay JWT; si no, a **`LOGIN_PATH`**.

## Duración de sesión (tiempo máximo logueado)

La sesión **no es indefinida**: el JWT de acceso caduca y deja de aceptarse en el API.

| Dónde | Qué |
|-------|-----|
| Backend | Variable **`JWT_EXPIRES_IN`** (Nest `JwtModule`). Valor por defecto en código: **`5d`** si no defines la variable. |
| Formato | Cadenas tipo [`jsonwebtoken` / `ms`](https://github.com/vercel/ms): `60s`, `8h`, `12h`, `1d`, `5d`, `7d`, etc. |
| Frontend | Si el token guardado en `localStorage` está **vencido** (claim `exp`), se elimina al leerlo; la app trata al usuario como no autenticado hasta que vuelva a iniciar sesión. |

No hay refresh token: al caducar el JWT hay que **volver a autenticarse** (enlace mágico o contraseña).

En producción, ajusta `JWT_EXPIRES_IN` según política (p. ej. `8h` jornada, `5d` o `7d` si se acepta más permanencia).

## Backend

- Login con contraseña y flujo de enlace mágico siguen documentados en `VERIFICACION.md` y README (endpoints `/auth/login`, `/auth/magic-link/*`).
- Mensajes genéricos al solicitar enlace: no revelar si el correo existe; copia alineada con `auth.service.ts`.

## Comprobación rápida

- Búsqueda en el repo: las redirecciones por 401 / logout deberían usar `redirectToLogin()` o `LOGIN_PATH`, no URLs inventadas.
