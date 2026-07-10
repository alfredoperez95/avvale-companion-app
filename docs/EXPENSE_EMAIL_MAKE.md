# Integración Make: entrada por email (Gastos)

El backend expone un webhook **HTTP** para que un escenario de **Make** envíe recibos recibidos por correo y cree gastos asociados al **usuario registrado** cuyo email coincide con el remitente.

Cada adjunto válido crea un gasto independiente y encola la extracción IA en BullMQ. La llamada responde rápido; la extracción de importe, tipo y fecha ocurre en background.

La descripción del gasto se genera a partir del contenido del adjunto (recibo, factura o proforma). El asunto del email solo se guarda como fallback corto mientras la extracción está pendiente o si el documento no aporta una descripción fiable.

## URL

- **Método:** `POST`
- **Ruta (Nest sin prefijo global):** `/webhooks/expense-email/inbound`
- Ejemplo local: `http://localhost:4000/webhooks/expense-email/inbound`
- Tras proxy Next (`/api/*`): `http://localhost:3000/api/webhooks/expense-email/inbound`

## Variables de entorno

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `EXPENSE_EMAIL_WEBHOOK_SECRET` | Sí (producción) | Secreto compartido; el body JSON debe incluir el mismo valor en `secret`. |
| `EXPENSE_EMAIL_MAX_ATTACHMENTS` | No | Máximo de adjuntos por correo (default 10). |
| `EXPENSE_MAX_FILE_BYTES` | No | Tamaño máximo por fichero decodificado (default 20 MiB). |
| `EXPENSE_QUEUE_ATTEMPTS` | No | Reintentos BullMQ para la extracción IA (default 3). |
| `EXPENSE_QUEUE_BACKOFF_MS` | No | Backoff exponencial inicial de la cola (default 8000 ms). |
| `HTTP_BODY_LIMIT` | No | Límite del body en Express (`json` / `urlencoded`). Default en código: `50mb`. Debe cubrir el payload JSON real (base64 infla ~4/3). |

## Cuerpo JSON (ejemplo)

```json
{
  "secret": "<EXPENSE_EMAIL_WEBHOOK_SECRET>",
  "fromEmail": "usuario@empresa.com",
  "subject": "Gastos viaje Madrid",
  "bodyPlain": "Recibos del viaje para procesar.",
  "threadContext": "Contexto opcional del hilo.",
  "attachments": [
    {
      "fileName": "taxi.pdf",
      "contentBase64": "<base64>",
      "contentType": "application/pdf"
    },
    {
      "fileName": "comida.jpg",
      "contentBase64": "<base64>",
      "contentType": "image/jpeg"
    }
  ]
}
```

## Adjuntos soportados

Cada elemento de `attachments` incluye siempre **`fileName`** y **`contentBase64`**. Opcionalmente:

- **`contentType`**: MIME original del adjunto. Tiene prioridad.
- **`mimeType`**: alias compatible con payloads antiguos; se usa si no llega `contentType`.

Formatos válidos para gastos: PDF, JPG/JPEG, PNG y HEIC/HEIF. Si un correo trae varios adjuntos, el backend crea un gasto por cada adjunto válido. Los adjuntos con formato no soportado se devuelven en `skipped` si al menos otro adjunto sí pudo procesarse.

## Respuestas

| Respuesta | Significado |
|-----------|-------------|
| `{ "ok": true, "expenseIds": ["..."] }` | Gastos creados y extracción encolada. |
| `{ "ok": true, "expenseIds": ["..."], "skipped": [{ "fileName": "nota.txt", "reason": "unsupported_format" }] }` | Creación parcial; algunos adjuntos se ignoraron. |
| `{ "ok": false, "reason": "unknown_sender" }` | El remitente no existe como usuario registrado. |
| `{ "ok": false, "reason": "no_anthropic_key" }` | El usuario no tiene clave Anthropic guardada. |
| `{ "ok": false, "reason": "no_valid_attachments" }` | No había adjuntos válidos. |
| `{ "ok": false, "reason": "too_many_attachments" }` | Se superó `EXPENSE_EMAIL_MAX_ATTACHMENTS`. |
| `{ "ok": false, "reason": "attachment_too_large" }` | Un adjunto supera `EXPENSE_MAX_FILE_BYTES`. |
| `{ "ok": false, "reason": "total_size_exceeded" }` | El tamaño total estimado supera el límite del correo. |
| `401` / `503` | Secreto inválido / webhook no configurado. |

## Escenario Make sugerido

1. **Trigger:** email entrante en el buzón de recibos.
2. **HTTP:** POST al webhook con el JSON anterior; mapear `From`, `Subject`, cuerpo y adjuntos a base64.
3. **Respuesta:** guardar `expenseIds` en logs si necesitas trazabilidad.
4. **Revisión:** el usuario entra en Gastos y revisa los registros creados.

## Interfaz en la app

En el frontend autenticado: **Gastos → Gastos por email** (`/launcher/expenses-process/email`) muestra la URL del webhook para el origen actual y un resumen de requisitos.

## Prueba local con `curl`

Con el backend en `:4000` y `EXPENSE_EMAIL_WEBHOOK_SECRET` definido en `backend/.env`:

```bash
curl -sS -X POST "http://localhost:4000/webhooks/expense-email/inbound" \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "TU_SECRETO",
    "fromEmail": "usuario@empresa.com",
    "subject": "Prueba gastos",
    "attachments": [
      {
        "fileName": "receipt.txt",
        "contentBase64": "SG9sYQ==",
        "contentType": "text/plain"
      }
    ]
  }'
```

Ese ejemplo usa un formato no soportado y debe responder `no_valid_attachments` si no hay otros adjuntos válidos. Para una prueba completa, envía un PDF o imagen real en base64.

## Cola y procesamiento

Tras crear cada gasto, el backend encola un job en BullMQ (`expense-extract`). Requiere **Redis** y la misma configuración base que el resto de colas (`REDIS_URL`, `BULL_PREFIX`, etc.).

## Credenciales Anthropic

La extracción usa la **clave Anthropic del usuario**. Si el usuario no tiene clave guardada, el webhook devuelve `{ "ok": false, "reason": "no_anthropic_key" }` y no crea gastos.
