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
| `RFQ_MAX_FILE_BYTES` | No | Tamaño máximo por fichero decodificado (default **50 MiB**). |
| `RFQ_MAX_TOTAL_BYTES_PER_ANALYSIS` | No | Suma aproximada de adjuntos por análisis (default **50 MiB**). |
| `HTTP_BODY_LIMIT` | No | Límite del body en Express (`json` / `urlencoded`). Default en código: **`50mb`**. Debe ser ≥ que el payload JSON real (base64 infla ~4/3). |

Copia los valores en `backend/.env` (o raíz + `./scripts/prepare-env.sh` si aplica).

## Límite de body en Nest (Express) y 413

El arranque (`main.ts`) desactiva el body parser por defecto de Nest y registra **`express.json`** y **`express.urlencoded`** con límite **`HTTP_BODY_LIMIT`** (por defecto `50mb`), para que los POST grandes del webhook no fallen antes de llegar al controlador.

Los límites de **negocio** (`RFQ_MAX_FILE_BYTES`, `RFQ_MAX_TOTAL_BYTES_PER_ANALYSIS`) se aplican en `handleInboundEmail` y, si se superan, la API responde `{ ok: false, reason: 'attachment_too_large' | 'total_size_exceeded' }` con **logs** indicando tamaños y límites.

## Proxy inverso (Nginx, Traefik, etc.)

Si el tráfico pasa por **Nginx** delante del backend, configura por ejemplo:

```nginx
client_max_body_size 50M;
```

Ajusta el valor acorde a `HTTP_BODY_LIMIT` y a tus necesidades. Sin esto, Nginx puede responder **413** antes de que Nest reciba el cuerpo.

**Next.js (`/api/*` → backend):** en algunos despliegues el proxy de desarrollo o el edge pueden imponer límites propios. Para webhooks muy grandes, suele ser más fiable apuntar Make **directamente** a la URL pública del **backend** (puerto interno detrás del balanceador) o subir el límite en el proxy que delante del frontend.

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
      "contentBase64": "<base64>",
      "contentType": "application/pdf"
    }
  ]
}
```

### Adjuntos: `contentType` y compatibilidad

Cada elemento de `attachments` incluye siempre **`fileName`** y **`contentBase64`**. Opcionalmente:

- **`contentType`** (recomendado desde Make): MIME original del adjunto (p. ej. `application/pdf`, tipo DOCX/XLSX ofimática). Tiene **prioridad** al guardar y al extraer texto.
- **`mimeType`**: alias histórico; si no hay `contentType`, el backend usa `mimeType` igual que antes.

Si no llega ninguno de los dos, o el valor no es un MIME usable, se hace **fallback por extensión** del `fileName` (p. ej. `.pdf` → `application/pdf`) y, en último caso, `application/octet-stream`.

### `bodyPlain` y `threadContext` (Make)

- Opcionales; se **recortan** (trim) y las cadenas vacías se tratan como ausentes.
- **`bodyPlain`**: cuerpo del correo en texto plano; genera fuente `EMAIL_BODY` (orden primero entre textos).
- **`threadContext`**: contexto adicional del hilo; genera fuente `THREAD_CONTEXT` **solo si** no es equivalente a `bodyPlain` tras normalizar espacios, saltos de línea y comparación **case-insensitive**. Si es duplicado, se registra en log y no se crea la segunda fuente.
- El **asunto** va en `title` / `originSubject` y encabeza el bundle del pipeline en metadatos.
- Función auxiliar `buildEmailInboundContextPreview` en código: ensambla asunto + cuerpo + hilo (sin duplicar) para logs y posibles extensiones; el análisis LLM sigue usando las **fuentes** ordenadas (cuerpo → hilo → archivos).

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
