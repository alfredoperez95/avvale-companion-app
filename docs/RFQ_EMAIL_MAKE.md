# Integración Make: entrada por email (Análisis RFQs)

El backend expone un webhook **HTTP** para que un escenario de **Make** envíe el contenido de un correo (scanner@avvalecompanion.app u otro buzón) y cree un análisis RFQ asociado al **usuario registrado** cuyo email coincide con el remitente.

## URL

- **Método:** `POST`
- **Ruta (Nest sin prefijo global):** `/webhooks/rfq-email/inbound`
- Ejemplo local: `http://localhost:4000/webhooks/rfq-email/inbound`
- Tras proxy Next (`/api/*`): `http://localhost:3000/api/webhooks/rfq-email/inbound` (según tu `next.config` / rewrite)

## Variables de entorno

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `RFQ_EMAIL_WEBHOOK_SECRET` | Sí (producción) | Secreto compartido; el body JSON debe incluir el mismo valor en `secret`. |
| `RFQ_MAX_ATTACHMENTS_PER_ANALYSIS` | No | Máximo de adjuntos (default 10). |
| `RFQ_MAX_FILE_BYTES` | No | Tamaño máximo por fichero en bytes (default 20 MB). |
| `RFQ_MAX_TOTAL_BYTES_PER_ANALYSIS` | No | Tamaño total aproximado por análisis (default 50 MB). |

Copia los valores en `backend/.env` (o raíz + `./scripts/prepare-env.sh` si aplica).

## Cuerpo JSON (ejemplo)

```json
{
  "secret": "<RFQ_EMAIL_WEBHOOK_SECRET>",
  "fromEmail": "usuario@empresa.com",
  "subject": "RFQ proyecto SAP",
  "bodyPlain": "Texto del correo…",
  "threadContext": "Resumen opcional del hilo…",
  "attachments": [
    {
      "fileName": "requisitos.pdf",
      "mimeType": "application/pdf",
      "contentBase64": "<base64>"
    }
  ]
}
```

- **Validación temprana:** si `fromEmail` no corresponde a un usuario en la tabla `users`, la API responde **200** con `{ "ok": false, "reason": "unknown_sender" }` y **no** encola trabajo costoso.
- Otros rechazos controlados: `too_many_attachments`, `attachment_too_large`, `total_size_exceeded`, `no_anthropic_key`, `no_content`, etc.
- Campos extra en el JSON: el endpoint usa un `ValidationPipe` que **no** rechaza propiedades adicionales (Make puede enviar metadatos).

## Escenario Make sugerido

1. **Trigger:** Email (o router) hacia el buzón configurado.
2. **HTTP:** POST al webhook con el JSON anterior; mapear `From`, `Subject`, cuerpo y adjuntos a base64.
3. **Respuesta:** Si `ok: true`, opcionalmente guardar `analysisId` en logs.

## Interfaz en la app

En el frontend autenticado: **Análisis RFQs → «Entrada por email»** (`/launcher/rfq-analysis/email`) muestra la URL del webhook para el origen actual (útil para copiar en Make) y un resumen de requisitos.

## Prueba local con `curl`

Con el backend en `:4000` y `RFQ_EMAIL_WEBHOOK_SECRET` definido en `backend/.env`:

```bash
curl -sS -X POST "http://localhost:4000/webhooks/rfq-email/inbound" \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "TU_SECRETO",
    "fromEmail": "usuario@empresa.com",
    "subject": "Prueba webhook",
    "bodyPlain": "Cuerpo mínimo para prueba."
  }'
```

Respuesta esperada si el usuario existe y tiene Anthropic: `{"ok":true,"analysisId":"..."}`. Si el remitente no está registrado: `{"ok":false,"reason":"unknown_sender"}`.

A través del proxy Next (`:3000`): misma ruta bajo `/api/…`:

```bash
curl -sS -X POST "http://localhost:3000/api/webhooks/rfq-email/inbound" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

## Cola y procesamiento

Tras crear el análisis, el backend encola el job en BullMQ (`rfq-analysis`). Requiere **Redis** y la misma configuración que el resto de colas (`REDIS_URL`, etc.).

## Credenciales Anthropic

El pipeline usa la **clave Anthropic del usuario** (igual que Yubiq). Si el usuario no tiene clave guardada, el flujo email devuelve `{ ok: false, reason: "no_anthropic_key" }`.

### Síntesis en dos fases

La fase **SYNTHESIZE** del pipeline siempre ejecuta primero el modelo configurado en `RFQ_SYNTHESIS_MODEL` (por defecto **haiku**, más económico). Una segunda pasada con `RFQ_SYNTHESIS_ESCALATION_MODEL` (por defecto **sonnet**) se ejecuta solo si:

- hay al menos un **adjunto de archivo** con extracción correcta cuyo `mimeType` no sea `application/pdf`, o
- la primera pasada **no** devuelve JSON válido para el insight.

Si el modelo de escalado es el mismo que el primario, no se duplica la llamada salvo el caso de JSON inválido en la primera pasada. El insight guardado refleja el modelo que aportó el resultado final (`synthesisModelId`). El chat del análisis sigue usando solo `RFQ_CHAT_MODEL` (sin escalado automático por mensaje).
