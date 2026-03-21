# Integración con Make (envíos)

El backend dispara un **webhook personalizado** en Make al solicitar el envío (`POST /api/activations/:id/send`). El cuerpo es un JSON **schema v2** definido en TypeScript en [`backend/src/make/make-webhook-payload.ts`](../backend/src/make/make-webhook-payload.ts).

## Variables de entorno

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `MAKE_WEBHOOK_URL` | Sí (para enviar) | URL del módulo *Custom webhook* en Make. |
| `MAKE_WEBHOOK_SECRET` | No | Si se define, el backend envía cabecera `X-Webhook-Secret` con este valor. |
| `MAKE_CALLBACK_SECRET` | Sí (para callback) | Secreto compartido en el cuerpo JSON del callback (ver abajo). |

Copia los valores en `.env` en la raíz y ejecuta `./scripts/prepare-env.sh` para propagar a `backend/.env`.

## Payload del webhook (v2)

Campos principales:

- `schemaVersion`: `2`
- `activationId`: UUID de la activación (clave técnica)
- `activationNumber`: entero secuencial único (humano / logs)
- `activationCode`: string derivado, p. ej. `ACT-000124` (misma regla que en la app)
- `recipientTo`, `recipientCc`, `subject`, `body`
- `projectName`, `client`, `offerCode`, `projectAmount`, `projectType`, `hubspotUrl`
- `createdBy`, `createdByUser` (`name`, `lastName`, `email`)
- `areas`, `subAreas` (ids y nombres)
- `attachments[]`: `url` y `fileName` (adjuntos o URLs escaneadas)

El asunto (`subject`) incluye el código visible, p. ej. `Activación AEP [ACT-000124] - CLIENTE - Proyecto`.

## Respuesta HTTP esperada (opcional)

Make puede devolver JSON con un identificador de ejecución para guardarlo en `make_run_id`. El backend reconoce el primer campo string presente entre: `makeRunId`, `executionId`, `imtId`, `id`. Puedes añadir un módulo **Webhook response** al final del escenario con un cuerpo JSON, por ejemplo:

```json
{ "makeRunId": "{{execution.id}}" }
```

(Ajusta la expresión según la versión de Make.)

## Callback al backend (opcional)

Tras enviar el correo (o si falla), Make puede llamar a:

- **URL:** `POST {BASE_URL}/api/webhooks/make/callback`  
  Ejemplo local: `http://localhost:4000/api/webhooks/make/callback`  
  Ejemplo producción: `https://tu-api.example.com/api/webhooks/make/callback`

- **Cuerpo JSON:**

```json
{
  "secret": "<MAKE_CALLBACK_SECRET>",
  "activationId": "<uuid de la activación>",
  "activationNumber": 124,
  "activationCode": "ACT-000124",
  "status": "sent",
  "errorMessage": null
}
```

`activationNumber` y `activationCode` son **opcionales** (trazabilidad en Make). Si se envían, deben coincidir con la activación referenciada por `activationId` (el identificador principal sigue siendo el UUID).

Para error: `"status": "error"` y `"errorMessage": "mensaje"`.

Requiere `MAKE_CALLBACK_SECRET` configurado en el backend. Si no está definido, el endpoint responde 503.

## Configuración sugerida del escenario en Make

1. **Trigger:** Webhooks → **Custom webhook** (método POST). Copia la URL a `MAKE_WEBHOOK_URL`.
2. **Parser:** El cuerpo del body suele ser el JSON enviado por Nest (o un objeto `data` según la configuración del webhook); usa el módulo *JSON* / *Parse JSON* si hace falta.
3. **Validación (opcional):** Si usas `MAKE_WEBHOOK_SECRET`, comprobar que la cabecera `X-Webhook-Secret` coincide.
4. **Envío:** Conector de correo (Gmail, Outlook, etc.) o el que use la organización. Puedes usar `activationCode` o `activationNumber` en el asunto o cuerpo.
5. **Respuesta (opcional):** **Webhook response** con JSON que incluya `makeRunId` o `executionId`.
6. **Callback (opcional):** Módulo **HTTP** → POST a `/api/webhooks/make/callback` con `secret`, `activationId`, `status` y opcionalmente `activationNumber` copiado del trigger.

## Estados en la BD

- Tras disparo correcto al webhook: `READY_TO_SEND` y opcionalmente `makeRunId`.
- Si el POST a Make falla: `ERROR` y `errorMessage`.
- Tras callback `sent`: `SENT` y `makeSentAt`.
- Tras callback `error`: `ERROR` y `errorMessage`.
