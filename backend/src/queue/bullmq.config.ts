import type { BullRootModuleOptions } from '@nestjs/bullmq';
import type { ConfigService } from '@nestjs/config';
import type { RedisOptions } from 'ioredis';

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = raw != null ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Parsea redis:// o rediss:// en opciones ioredis (sin propiedad `url` en el tipado estricto). */
function redisOptionsFromUrl(redisUrl: string): RedisOptions {
  const u = new URL(redisUrl);
  const password = u.password ? decodeURIComponent(u.password) : undefined;
  const pathname = u.pathname?.replace(/^\//, '');
  const db =
    pathname && pathname.length > 0 && pathname !== '/'
      ? parseInt(pathname.split('/')[0]!, 10)
      : 0;
  return {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    host: u.hostname || '127.0.0.1',
    port: u.port ? parseInt(u.port, 10) : 6379,
    username: u.username ? decodeURIComponent(u.username) : undefined,
    password,
    tls: u.protocol === 'rediss:' ? {} : undefined,
    db: Number.isFinite(db) && db >= 0 ? db : 0,
  };
}

export function bullRootModuleOptionsFactory(config: ConfigService): BullRootModuleOptions {
  const url = config.get<string>('REDIS_URL')?.trim();
  let connection: RedisOptions;
  if (url) {
    connection = redisOptionsFromUrl(url);
  } else {
    const password = config.get<string>('REDIS_PASSWORD')?.trim();
    const dbRaw = config.get<string>('REDIS_DB');
    const dbParsed = dbRaw != null ? parseInt(dbRaw, 10) : 0;
    const db = Number.isFinite(dbParsed) && dbParsed >= 0 ? dbParsed : 0;
    connection = {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      host: config.get<string>('REDIS_HOST')?.trim() || '127.0.0.1',
      port: parsePositiveInt(config.get<string>('REDIS_PORT'), 6379),
      password: password === '' || password == null ? undefined : password,
      db,
    };
  }

  const prefix = config.get<string>('BULL_PREFIX')?.trim() || 'avvale';

  return {
    connection,
    prefix,
  };
}

export function activationSendQueueDefaultsFactory(config: ConfigService): {
  attempts: number;
  backoff: { type: 'exponential'; delay: number };
  removeOnComplete: boolean;
  removeOnFail: boolean;
} {
  return {
    attempts: parsePositiveInt(config.get<string>('ACTIVATION_SEND_QUEUE_ATTEMPTS'), 5),
    backoff: {
      type: 'exponential',
      delay: parsePositiveInt(config.get<string>('ACTIVATION_SEND_QUEUE_BACKOFF_MS'), 5000),
    },
    removeOnComplete: true,
    removeOnFail: false,
  };
}

export function rfqAnalysisQueueDefaultsFactory(config: ConfigService): {
  attempts: number;
  backoff: { type: 'exponential'; delay: number };
  removeOnComplete: boolean;
  removeOnFail: boolean;
} {
  return {
    attempts: parsePositiveInt(config.get<string>('RFQ_QUEUE_ATTEMPTS'), 3),
    backoff: {
      type: 'exponential',
      delay: parsePositiveInt(config.get<string>('RFQ_QUEUE_BACKOFF_MS'), 8000),
    },
    removeOnComplete: true,
    removeOnFail: false,
  };
}
