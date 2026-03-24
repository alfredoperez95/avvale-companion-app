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
  const fromEnv = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const isDev = process.env.NODE_ENV !== 'production';
  const merged = isDev
    ? [...new Set([...fromEnv, 'http://localhost:3000', 'http://127.0.0.1:3000'])]
    : fromEnv.length > 0
      ? fromEnv
      : ['http://localhost:3000'];
  app.enableCors({
    origin: merged.length === 1 ? merged[0] : merged,
    credentials: true,
  });
  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`Backend running at http://localhost:${port}/api`);
  console.log(`CORS allowed origins: ${merged.join(', ')}`);
}
bootstrap();
