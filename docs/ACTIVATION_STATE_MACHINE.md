# Activaciones — máquina de estados y cola BullMQ

## Estado inicial

- **`DRAFT`**: la activación se ha creado con `POST /api/activations` y aún no se ha solicitado el envío a Make, o se revirtió tras un fallo al encolar (Redis).

> **Nota sobre “PENDING” de producto:** si en negocio quieres llamar “pendiente” al borrador antes de enviar, eso corresponde a **`DRAFT`** en la base de datos.

---

## Estados y significado

| Estado | Significado breve |
|--------|-------------------|
| `DRAFT` | Editable; no hay job de envío en curso. |
| `QUEUED` | `POST …/send` encoló el trabajo; esperando worker. |
| `PROCESSING` | Worker ejecutando intento de llamada al webhook de Make. |
| `RETRYING` | Último intento falló; BullMQ reintentará según backoff. |
| `PENDING_CALLBACK` | El webhook de Make respondió OK (2xx); el escenario en Make corre; falta el **callback HTTP** para cerrar como enviado o error. |
| `SENT` | Make notificó éxito vía callback. |
| `FAILED` | Error terminal (callback de error Make, timeout esperando callback, agotar reintentos Bull, error no recuperable, etc.). |

---

## Transiciones válidas (resumen)

| Desde | Hacia | Actor |
|-------|--------|--------|
| `DRAFT` | `QUEUED` | **API** (`POST /api/activations/:id/send`) tras publicar adjuntos y `queue.add`. |
| `FAILED` \| `RETRYING` | `QUEUED` | **API** (mismo endpoint de envío; reintento manual de usuario). |
| `QUEUED` | `PROCESSING` | **Worker** (`ActivationSendProcessor`). |
| `PROCESSING` | `PENDING_CALLBACK` | **Worker** vía **`ActivationSendOrchestrator`** + `MakeService.triggerWebhook` si 2xx. |
| `PROCESSING` | `RETRYING` | **Worker** (evento `failed` de Bull si quedan intentos). |
| `PROCESSING` | `FAILED` | **Worker** (sin intentos, `UnrecoverableError`, etc.). |
| `RETRYING` | `PROCESSING` | **Worker** (siguiente intento automático). |
| `RETRYING` | `FAILED` | **Worker** (último intento fallido). |
| `PENDING_CALLBACK` | `SENT` | **Callback Make** (`MakeService.handleActivationCallback`, `status: sent`). |
| `PENDING_CALLBACK` | `FAILED` | **Callback Make** (error) o **watchdog** (timeout sin callback). |
| `QUEUED` \| `PROCESSING` \| `RETRYING` | `SENT` \| `FAILED` | **Callback Make** (condición de carrera: Make responde muy rápido). |
| *cualquiera* | *(sin envío activo)* | **API** puede llevar a eliminación (`DELETE`); solo **`DRAFT`** permite `PATCH` de edición. |

---

## Transiciones no válidas (no soportadas por diseño)

- De **`SENT`** a cualquier estado distinto de eliminación — no hay “re-envío” del mismo ciclo; una nueva activación sería otro registro.
- De **`DRAFT`** a `PENDING_CALLBACK` / `SENT` **sin** pasar por la cola y el webhook — el flujo exige `QUEUED` → `PROCESSING` → …
- **`PATCH`** de activación si el estado no es **`DRAFT`** (regla de negocio actual).
- Callback Make que intente cerrar desde **`DRAFT`** — se rechaza con `400` (salvo evolución explícita del contrato).

---

## Dependencias circulares (`forwardRef`)

- **Eliminado** entre `ActivationSendOrchestrator` y `ActivationsService`: el orquestador usa **`ActivationLookupService`** (solo Prisma + contactos facturación para `manualCcEmails`), sin conocer la cola.
- **Sigue existiendo** `forwardRef` entre **`ActivationsService`** y **`ActivationSendProducer`**, porque el servicio de aplicación debe encolar y el producer vive en el módulo de cola que a su vez importa el módulo de activaciones para registrar el processor y el orquestador. Romper eso implicaría mover el producer a `ActivationsModule` o introducir un bus de eventos; no aporta hoy frente al coste.

---

## Integración técnica (cola ↔ Make)

| Pieza | Ubicación / responsabilidad |
|--------|-----------------------------|
| **Endpoint que encola** | `POST /api/activations/:id/send` → `ActivationsService.requestSend` → publica adjuntos, persiste `QUEUED`, `ActivationSendProducer.enqueueSendActivation`. |
| **Cola Redis (BullMQ)** | Nombre: `activation-send` ([`queue.constants.ts`](../backend/src/queue/queue.constants.ts)). |
| **Processor / worker** | `ActivationSendProcessor` — pone `PROCESSING`, delega en el orquestador, maneja `failed` → `RETRYING` / `FAILED`. |
| **Orquestación negocio Make** | `ActivationSendOrchestrator` — carga activación (`ActivationLookupService`), construye payload, llama `MakeService.triggerWebhook`, pone `PENDING_CALLBACK` si OK. |
| **Cliente HTTP a Make** | `MakeService.triggerWebhook` — POST al webhook; sin lanzar; resultado lo usa el orquestador. |
| **Callback que cierra el ciclo** | `POST /api/webhooks/make/callback` → `MakeService.handleActivationCallback` → `SENT` o `FAILED` (sin Bull). |

---

## Variables de entorno relacionadas

- **Redis / Bull**: `REDIS_URL` o `REDIS_HOST` / `REDIS_PORT` / …, `BULL_PREFIX`, `ACTIVATION_SEND_QUEUE_ATTEMPTS`, `ACTIVATION_SEND_QUEUE_BACKOFF_MS` (ver `.env.example` del backend).
- **Watchdog callback**: `MAKE_PENDING_CALLBACK_TIMEOUT_MS` (o compatibilidad `MAKE_READY_TO_SEND_TIMEOUT_MS`) — tiempo máximo en `PENDING_CALLBACK` antes de marcar `FAILED` por timeout.

---

## Pruebas recomendadas

- **Unit**: mockear `MakeService.triggerWebhook` en tests del orquestador.
- **Integración**: Redis + un job real + comprobar transiciones en MariaDB.
- **E2E**: `POST send` → estado `QUEUED` → procesar → `PENDING_CALLBACK` → simular callback → `SENT`.
