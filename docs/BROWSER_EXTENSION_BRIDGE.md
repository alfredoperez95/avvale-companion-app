# Puente web ↔ extensión (descargas con sesión del usuario)

La aplicación Companion no descarga URLs privadas (p. ej. HubSpot) en el servidor. El flujo **Descargar con extensión** delega la descarga en **Avvale Companion** (content script + service worker), usando la sesión autenticada del navegador.

## Transporte

- Eventos DOM en `document`, **no** `window.postMessage`.
- Petición: `avvale-extension-request` (`CustomEvent`, `bubbles: true`, `composed: true`).
- Respuesta: `avvale-extension-response`.

La página no puede usar `chrome.runtime`; el content script escucha los eventos y reenvía al service worker si hace falta.

## Ping existente

La detección de extensión sigue usando el ping heredado (`avvale-companion-ping` / `avvale-companion-pong`) definido en `frontend/src/lib/yubiq/companion-app-dispatch.ts`. El protocolo siguiente **no** redefine un PING.

## Contrato de mensajes (`schemaVersion`: 1)

### Campos comunes (petición desde la web)

| Campo | Valor |
|--------|--------|
| `schemaVersion` | `1` |
| `requestId` | UUID generado por la página |
| `source` | `avvale-companion-web` |
| `type` | Ver abajo |
| `payload` | Objeto según `type` |

### Respuesta (desde la extensión)

| Campo | Valor |
|--------|--------|
| `schemaVersion` | `1` |
| `requestId` | Mismo que la petición |
| `source` | `avvale-companion-extension` |
| `type` | Mismo que la petición |
| `ok` | `boolean` |
| `error?` | Código estable (ver tabla) |
| `data?` | Según operación |

### Tipos de operación

#### `DOWNLOAD_FILES`

**Payload:**

```json
{
  "batchId": "<uuid>",
  "items": [
    { "url": "https://...", "suggestedName": "opcional.pdf" }
  ]
}
```

Solo URLs `http:` / `https:` (la web valida antes de enviar).

**Respuesta:** `ok: true` si el lote quedó almacenado en el almacenamiento temporal de la extensión (IndexedDB, `chrome.storage`, etc.), no en la carpeta Descargas del sistema.

#### `GET_TEMP_FILES`

**Payload:** `{ "batchId": "<uuid>" }`

**Data si `ok`:**

```json
{
  "files": [
    {
      "originalUrl": "https://...",
      "name": "documento.pdf",
      "mimeType": "application/pdf",
      "arrayBuffer": "<ArrayBuffer>"
    }
  ]
}
```

`originalUrl` permite que la web envíe `originalUrl` en el `multipart` de subida al API. Tamaño máximo por fichero en cliente: **20 MiB** (constante compartida con el fetch en memoria).

#### `CLEAR_TEMP_FILES`

**Payload:** `{ "batchId": "<uuid>" }`

Elimina del almacenamiento temporal de la extensión todo lo asociado a ese `batchId`.

### Códigos `error` recomendados

| Código | Uso |
|--------|-----|
| `extension_timeout` | Sin respuesta en el tiempo esperado |
| `invalid_payload` | Payload inválido o fichero demasiado grande |
| `download_failed` | Fallo al descargar una o más URLs |
| `batch_not_found` | `batchId` desconocido o ya limpiado |
| `unknown` | Error no clasificado |

## Timeouts en la web (orientativos)

- `DOWNLOAD_FILES`: 120 s  
- `GET_TEMP_FILES` / `CLEAR_TEMP_FILES`: 30 s  

## Comportamiento esperado en la extensión

1. Escuchar `avvale-extension-request`, validar `source` y `schemaVersion`.
2. Responder siempre con `avvale-extension-response` y el mismo `requestId` y `type`.
3. Mantener datos por `batchId` hasta `CLEAR_TEMP_FILES` o hasta que la web indique limpieza tras subida correcta.
4. Implementar la descarga autenticada con los permisos/host que correspondan (fuera del alcance de este repo).

## Archivos de referencia en el frontend

- `frontend/src/types/browser-extension-protocol.ts` — constantes y tipos
- `frontend/src/lib/browser-extension.ts` — cliente (`sendExtensionRequest`, helpers)
- `frontend/src/hooks/useActivationExtensionDownloads.ts` — estado de UI y subida al API
