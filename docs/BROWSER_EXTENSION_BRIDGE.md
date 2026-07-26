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

Cada elemento de `files` debe llevar el binario de una de estas formas (la web prioriza `dataBase64` si viene relleno):

- **`dataBase64`** (recomendado): cadena base64 del contenido **sin** prefijo `data:...;base64,`. Evita pérdida de datos al cruzar content script ↔ página en Chrome MV3, donde un `ArrayBuffer` en `CustomEvent.detail` a veces llega **vacío** (0 B) aunque el nombre y el MIME sean correctos.
- **`arrayBuffer`**: `ArrayBuffer` no vacío. Si el buffer llega vacío o corrupto, la subida fallará con `invalid_payload`. Conviene copiar antes de despachar: `buffer.slice(0)` para que el clon sea estable.

Ejemplo orientativo (el transporte real es `CustomEvent.detail`, **no** `JSON.stringify` del binario):

```json
{
  "files": [
    {
      "originalUrl": "https://...",
      "name": "documento.pdf",
      "mimeType": "application/pdf",
      "dataBase64": "JVBERi0xLjQK..."
    }
  ]
}
```

`originalUrl` permite que la web envíe `originalUrl` en el `multipart` de subida al API. Tamaño máximo por fichero en cliente: **20 MiB** (constante compartida con el fetch en memoria).

#### `STORE_LOCAL_FILES`

Guarda en la extensión archivos ya seleccionados localmente por el usuario en Companion. Se usa en Yubiq Approve & Seal antes de abrir `#addnew`: la web envía los bytes del PDF de oferta y, si existe, el Excel PFE; la extensión responde `ok: true` solo cuando el lote está disponible para uso posterior en la pestaña Yubiq.

**Payload:**

```json
{
  "batchId": "<uuid>",
  "files": [
    {
      "role": "offer_pdf",
      "name": "oferta.pdf",
      "mimeType": "application/pdf",
      "size": 12345,
      "dataBase64": "JVBERi0xLjQK..."
    },
    {
      "role": "pfe_excel",
      "name": "PFE.xlsx",
      "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "size": 23456,
      "dataBase64": "UEsDB..."
    }
  ]
}
```

Roles permitidos:

- `offer_pdf`: PDF de oferta, obligatorio.
- `pfe_excel`: Excel PFE, opcional.

La extensión debe almacenar los bytes por `batchId` en IndexedDB o almacenamiento equivalente accesible desde el service worker/content script. `dataBase64` no lleva prefijo `data:...;base64,`.

**Respuesta:** `ok: true` si todos los archivos quedaron almacenados y recuperables por `batchId`. Si la extensión no soporta todavía esta operación, Companion no debe abrir Yubiq y mostrará un mensaje para actualizar/activar la extensión.

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
| `payload_too_large` | Algún fichero supera el tamaño máximo admitido |
| `unknown` | Error no clasificado |

## Timeouts en la web (orientativos)

- `DOWNLOAD_FILES`: 120 s  
- `STORE_LOCAL_FILES` / `GET_TEMP_FILES` / `CLEAR_TEMP_FILES`: 30 s  

## Comportamiento esperado en la extensión

1. Escuchar `avvale-extension-request`, validar `source` y `schemaVersion`.
2. Responder siempre con `avvale-extension-response` y el mismo `requestId` y `type`.
3. Mantener datos por `batchId` hasta `CLEAR_TEMP_FILES` o hasta que la web indique limpieza tras subida correcta.
4. Implementar la descarga autenticada con los permisos/host que correspondan (fuera del alcance de este repo).
5. Para `STORE_LOCAL_FILES`, aplicar un TTL defensivo a lotes temporales no consumidos.

## Archivos de referencia en el frontend

- `frontend/src/types/browser-extension-protocol.ts` — constantes y tipos
- `frontend/src/lib/browser-extension.ts` — cliente (`sendExtensionRequest`, helpers)
- `frontend/src/hooks/useActivationExtensionDownloads.ts` — estado de UI y subida al API

---

## Yubiq Approve & Seal — home + «Recopilar información»

Complementa el flujo de **prefill** (`avvale-companion-yubiq-start` → `#addnew`). Aquí Companion pide a la extensión **abrir** la home de Approve & Seal (sesión del navegador) y, en esa pestaña, la extensión muestra «Recopilar información».

### URL canónica

```
https://avvale-aes-y5ui.yubiq.app/YUBIK/home?
```

Constante: `YUBIQ_AS_HOME_URL` / target `yubiq_home` (`frontend/src/types/yubiq-payload.ts`).

### Abrir desde Companion («Explorar»)

Transporte: `CustomEvent` en `document` (`bubbles: true`, `composed: true`). **Sin** `chrome.runtime` ni `window.open` / `<a target=_blank>` desde la página.

| Dirección | Evento | Detail |
|-----------|--------|--------|
| Web → extensión | `avvale-companion-yubiq-as-open` (`AVVALE_YUBIQ_AS_EVENT_OPEN`) | `{ targetUrl?: string }` (default: `YUBIQ_AS_HOME_URL`) |
| Extensión → web | `avvale-companion-yubiq-as-open-result` (`AVVALE_YUBIQ_AS_EVENT_OPEN_RESULT`) | `{ ok: boolean, tabId?: number, error?: string }` |

Helpers: `dispatchYubiqAsOpenToExtension`, `onYubiqAsOpenResult`, `dispatchYubiqAsOpenToExtensionAndWait`, `messageForYubiqAsOpenResult` en `frontend/src/lib/yubiq/companion-app-dispatch.ts`.

En activaciones, el botón **Explorar** (Yubiq A&S) usa ese puente. Si `ok: false` o timeout → mensaje para instalar/activar la extensión.

### Content script en Yubiq (tras OPEN)

1. `matches` / `host_permissions`: `https://avvale-aes-y5ui.yubiq.app/*`
2. Inyectar botón idempotente:
   - `id`: `avvale-companion-yubiq-as-collect`
   - Texto: `Recopilar información`
3. Al hacer clic en «Recopilar información»:
   1. `pageUrl` = `location.href` (http/https).
   2. `yubiqAsId` = texto del código AES en el encabezado del documento, p. ej.:
      ```html
      <span class="fw-bold fs-5 mx-3">AES0003108</span>
      ```
      Selector orientativo: `span.fw-bold.fs-5.mx-3` (trim; validar patrón tipo `/^AES\d+$/i` si hay varios spans).
   3. Enviar a la **pestaña Companion** que originó el OPEN (`openerTabId`).
   4. Content script en Companion:
      ```js
      document.dispatchEvent(new CustomEvent('avvale-companion-yubiq-as-collect-result', {
        bubbles: true,
        composed: true,
        detail: { ok: true, pageUrl, yubiqAsId }
      }));
      ```
   5. **Cerrar** la pestaña Yubiq (`chrome.tabs.remove`).
4. Companion rellena `#yubiqAsUrl` y `#yubiqAsId`. Helpers: `onYubiqAsCollectResult`, `resolveYubiqAsCollectResult`.

### Relación con el prefill existente

| Flujo | URL | Evento Companion ↔ extensión |
|--------|-----|------------------------------|
| Prefill oferta (PDF) | `#addnew` | `STORE_LOCAL_FILES` + `avvale-companion-yubiq-start` + `YubiqChromePayload.extensionFiles` |
| Explorar A&S | `/YUBIK/home?` | OPEN → OPEN_RESULT |
| Recopilar | pestaña Yubiq | COLLECT_RESULT → `#yubiqAsUrl` + `#yubiqAsId` + cierre pestaña |

No mezclar con el pipeline de prefill en el mismo click handler.
