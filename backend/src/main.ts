import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { json, urlencoded, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { assertProductionSecrets } from './security/assert-production-secrets';
import { GlobalExceptionFilter } from './security/global-exception.filter';
import { requestIdMiddleware } from './security/request-id.middleware';
import { requestLoggingMiddleware } from './security/request-logging.middleware';

/**
 * Límite global del body JSON/urlencoded (Express).
 * Debe cubrir webhooks con adjuntos en base64 (p. ej. RFQ email). Ajustable vía HTTP_BODY_LIMIT (p. ej. 50mb).
 */
const HTTP_BODY_LIMIT = process.env.HTTP_BODY_LIMIT?.trim() || '50mb';
const PERMISSIONS_POLICY =
  'camera=(), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()';
const logger = new Logger('Bootstrap');

async function bootstrap() {
  assertProductionSecrets();

  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });
  app.enableShutdownHooks();

  const isProd = process.env.NODE_ENV === 'production';
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', process.env.TRUST_PROXY_HOPS?.trim() || 'loopback');
  expressApp.set('query parser', 'extended');

  app.use(requestIdMiddleware);
  app.use(
    helmet({
      // El documento HTML lo endurece Next (CSP con nonce); aquí no forzamos CSP en JSON API.
      contentSecurityPolicy: false,
      frameguard: { action: 'deny' },
      crossOriginEmbedderPolicy: { policy: 'credentialless' },
      crossOriginResourcePolicy: { policy: 'same-origin' },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hsts: isProd
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    }),
  );
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
    next();
  });

  app.use(
    json({
      limit: HTTP_BODY_LIMIT,
      verify: (req: Request, _res, buf: Buffer) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(urlencoded({ limit: HTTP_BODY_LIMIT, extended: true }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.use(requestLoggingMiddleware);
  const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Permitir requests sin origin (ej: Postman, healthchecks)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      /**
       * No pasar `Error` al callback: el middleware `cors` hace `next(err)` y Nest responde **500**.
       * Orígenes no listados (p. ej. `chrome-extension://…`) deben negarse con `callback(null, false)`.
       * Para permitir una extensión, añade su origen exacto a `CORS_ORIGIN` (coma-separado).
       */
      logger.warn(`CORS: origen no permitido (no 500): ${origin}`);
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With', 'X-Request-Id'],
    exposedHeaders: ['Content-Disposition', 'X-Export-Expires-At'],
  });
  const port = process.env.PORT ?? 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`Backend running at http://localhost:${port}`);
  console.log(`HTTP body limit (JSON / urlencoded): ${HTTP_BODY_LIMIT}`);
  console.log(`CORS allowed origins: ${allowedOrigins.join(', ') || '(vacío)'}`);
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
