# Integración con Make (envíos)

El backend dispara un **webhook personalizado** en Make al solicitar el envío (`POST /api/activations/:id/send`). El cuerpo es un JSON **schema v4** definido en TypeScript en [`backend/src/make/make-webhook-payload.ts`](../backend/src/make/make-webhook-payload.ts).

La **firma HTML** global se configura en la app (Configuración → Firma) y se expone en el campo `emailSignature` del payload.

## Variables de entorno

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `MAKE_WEBHOOK_URL` | Sí (para enviar) | URL del módulo *Custom webhook* en Make. |
| `MAKE_WEBHOOK_SECRET` | No | Si se define, el backend envía cabecera `X-Webhook-Secret` con este valor. |
| `MAKE_CALLBACK_SECRET` | Sí (para callback) | Secreto compartido en el cuerpo JSON del callback (ver abajo). |
| `BACKEND_PUBLIC_URL` | Recomendada | URL pública del backend (con o sin `/api`) para construir `attachments[].url` públicos temporales. Si falta, se usa `NEXT_PUBLIC_API_URL` y luego `http://localhost:4000`. |

Copia los valores en `.env` en la raíz y ejecuta `./scripts/prepare-env.sh` para propagar a `backend/.env`.

## Payload del webhook (v4)

Campos principales:

- `schemaVersion`: `4`
- `activationId`: UUID de la activación (clave técnica)
- `activationNumber`: entero secuencial único (humano / logs)
- `activationCode`: string derivado, p. ej. `ACT-000124` (misma regla que en la app)
- `emailSignature`: HTML de la firma global, o `null` si no hay firma guardada o solo espacios
- `recipientTo` (array), `recipientToCsv`, `toRecipients`, `recipientCc` (array), `recipientCcCsv`, `ccRecipients`, `subject`, `body`
- `projectName`, `client`, `offerCode`, `projectAmount`, `projectType`, `hubspotUrl`
- `createdBy`, `createdByUser` (`name`, `lastName`, `email`)
- `areas`, `subAreas` (ids y nombres)
- `attachments[]`: `url` y `fileName` (URL pública temporal del archivo almacenado en backend)

El asunto (`subject`) incluye el código visible, p. ej. `Activación AEP [ACT-000124] - CLIENTE - Proyecto`.

En Make, suele concatenarse el cuerpo del mensaje con la firma, p. ej. `body` + `emailSignature` (respetando HTML).

`recipientTo` se envía como array de emails (formato recomendado para mapear en Microsoft 365 Email / Outlook en Make), por ejemplo:

```json
[
  "javier.llaguno@avvale.com",
  "alberto.hernandez@avvale.com"
]
```

`toRecipients` y `ccRecipients` se envían como arrays de objetos con **`address` en la raíz** (lo que exige la validación del módulo **Microsoft 365 Email** en Make), por ejemplo:

```json
[
  { "address": "javier.llaguno@avvale.com" },
  { "address": "alberto.hernandez@avvale.com" }
]
```

Si no hay destinatarios en copia, `ccRecipients` es `[]`. En el módulo Outlook, mapea **To** a `toRecipients` y **CC** a `ccRecipients` (no uses `recipientCc`, que es un array de strings).

**v4:** mantiene esta forma `{ "address" }` y añade el campo `ccRecipients` (en v3 solo existía `toRecipients` con la misma forma).

`recipientToCsv` se mantiene como string CSV por compatibilidad retroactiva.

### Descarga de adjuntos desde Make

- `attachments[].url` apunta al endpoint público temporal `GET /api/public/attachments/:token`.
- No requiere JWT para la descarga (token no adivinable en la URL).
- El acceso público se revoca automáticamente **30 minutos después del callback `SENT`**.
- La revocación elimina solo la publicación pública; el archivo sigue almacenado en backend.

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
4. **Envío:** Conector **Microsoft 365 Email (Outlook)** o similar. Para Outlook, enlaza `toRecipients` y `ccRecipients` del JSON del webhook. Usa `body`, `emailSignature`, `subject`, `activationCode`, etc., según tu plantilla de correo.
5. **Respuesta (opcional):** **Webhook response** con JSON que incluya `makeRunId` o `executionId`.
6. **Callback (opcional):** Módulo **HTTP** → POST a `/api/webhooks/make/callback` con `secret`, `activationId`, `status` y opcionalmente `activationNumber` copiado del trigger.

## Estados en la BD

- Tras **POST /activations/:id/send** (publicación de adjuntos): `QUEUED`; el worker pasa a `PROCESSING` y luego, si Make responde OK al webhook, `PENDING_CALLBACK` y opcionalmente `makeRunId`. Ver [ACTIVATION_STATE_MACHINE.md](./ACTIVATION_STATE_MACHINE.md).
- Reintentos BullMQ: `RETRYING` con `errorMessage`; agotados los intentos: `FAILED`.
- Si el POST a Make falla sin más reintentos: `FAILED` y `errorMessage`.
- Tras callback `sent`: `SENT` y `makeSentAt`.
- Tras callback `error`: `FAILED` y `errorMessage`.
