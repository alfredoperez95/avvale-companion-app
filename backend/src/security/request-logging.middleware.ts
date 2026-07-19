import { Logger } from '@nestjs/common';
import { type NextFunction, type Response } from 'express';
import type { RequestWithId } from './request-id.middleware';
import { redactSensitive } from './sensitive-redaction';

const logger = new Logger('HTTP');

export function requestLoggingMiddleware(req: RequestWithId, res: Response, next: NextFunction) {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const user = req.user as { userId?: string; email?: string; role?: string } | undefined;
    const meta = redactSensitive({
      requestId: req.requestId,
      method: req.method,
      path: req.route?.path || req.path,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs),
      ip: req.ip,
      userId: user?.userId,
      role: user?.role,
    });

    logger.log(JSON.stringify(meta));
  });

  next();
}
