import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
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
  console.log(`Backend running at http://localhost:${port}/api`);
  console.log(`CORS allowed origins: ${allowedOrigins.join(', ')}`);
}

bootstrap().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
