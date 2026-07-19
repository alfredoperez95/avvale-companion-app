import { randomUUID } from 'crypto';
import { type NextFunction, type Request, type Response } from 'express';

export type RequestWithId = Request & { requestId?: string };

export function requestIdMiddleware(req: RequestWithId, res: Response, next: NextFunction) {
  const incoming = req.headers['x-request-id'];
  const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
  const requestId =
    typeof candidate === 'string' && /^[a-zA-Z0-9._:-]{8,128}$/.test(candidate)
      ? candidate
      : randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
