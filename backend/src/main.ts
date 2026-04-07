import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';

/**
 * Límite global del body JSON/urlencoded (Express).
 * Debe cubrir webhooks con adjuntos en base64 (p. ej. RFQ email). Ajustable vía HTTP_BODY_LIMIT (p. ej. 50mb).
 */
const HTTP_BODY_LIMIT = process.env.HTTP_BODY_LIMIT?.trim() || '50mb';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });
  if (process.env.NODE_ENV === 'production') {
    app.use(
      helmet({
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: { policy: 'cross-origin' },
      }),
    );
  }
  app.use(json({ limit: HTTP_BODY_LIMIT }));
  app.use(urlencoded({ limit: HTTP_BODY_LIMIT, extended: true }));

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
  console.log(`HTTP body limit (JSON / urlencoded): ${HTTP_BODY_LIMIT}`);
  console.log(`CORS allowed origins: ${allowedOrigins.join(', ')}`);
  if (process.env.MAIL_SKIP_SEND === 'true') {
    console.warn(
      '[MAIL] MAIL_SKIP_SEND=true: no se envían correos reales (solo enlace en logs). Producción: MAIL_SKIP_SEND=false (o sin definir) y SMTP_HOST/SMTP_USER/SMTP_PASS.',
    );
  }
}

bootstrap().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
