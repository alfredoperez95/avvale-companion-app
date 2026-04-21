import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    /** Cuerpo bruto del POST JSON (p. ej. verificación HMAC de webhooks). Rellenado en `main.ts` vía `json({ verify })`. */
    rawBody?: Buffer;
  }
}

export {};
