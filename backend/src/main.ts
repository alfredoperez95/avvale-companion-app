import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import type { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // #region agent log
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.url?.includes('ai-credentials')) {
      fetch('http://127.0.0.1:7401/ingest/4ab151b9-cbda-4400-a5db-364c7cddddff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '86e2d8' },
        body: JSON.stringify({
          sessionId: '86e2d8',
          location: 'main.ts:middleware',
          message: 'incoming ai-credentials',
          data: { method: req.method, url: req.url, path: req.path },
          timestamp: Date.now(),
          hypothesisId: 'H2',
          runId: 'post-fix',
        }),
      }).catch(() => {});
    }
    next();
  });
  // #endregion
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requests sin origin (ej: Postman, healthchecks)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS not allowed for origin: ${origin}`), false);
    },
    credentials: true,
  });
  const port = process.env.PORT ?? 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`Backend running at http://localhost:${port}`);
  console.log(`CORS allowed origins: ${allowedOrigins.join(', ')}`);
}

bootstrap().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
