import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ActivationsModule } from './activations/activations.module';
import { AreasModule } from './areas/areas.module';
import { ContactsModule } from './contacts/contacts.module';
import { BillingAdminContactsModule } from './billing-admin-contacts/billing-admin-contacts.module';
import { EmailTemplatesModule } from './email-templates/email-templates.module';
import { EmailSignatureModule } from './email-signature/email-signature.module';
import { UserConfigModule } from './user-config/user-config.module';
import { QueueModule } from './queue/queue.module';
import { HealthController } from './health.controller';
import { AiCredentialsModule } from './ai-credentials/ai-credentials.module';
import { YubiqModule } from './yubiq/yubiq.module';
import { RfqAnalysisModule } from './rfq-analysis/rfq-analysis.module';
import * as path from 'path';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'magic-link', ttl: 60_000, limit: 5 },
        /** Login, registro y verificación de magic link (por IP). En varias réplicas usar storage Redis del throttler. */
        { name: 'auth-brute', ttl: 60_000, limit: 20 },
      ],
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      // Asegura carga de env aunque el backend se arranque desde la raíz del repo.
      envFilePath: [
        // Cuando corre desde /backend (dev), process.cwd() ya es /backend.
        path.resolve(process.cwd(), '.env'),
        // Cuando corre desde la raíz del repo, process.cwd() incluye /backend/.env.
        path.resolve(process.cwd(), 'backend', '.env'),
        // Cuando corre desde /backend/dist (prod), __dirname apunta a /backend/dist.
        path.resolve(__dirname, '..', '.env'),
        path.resolve(__dirname, '..', '..', '.env'),
      ],
    }),
    QueueModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ActivationsModule,
    AreasModule,
    ContactsModule,
    BillingAdminContactsModule,
    EmailTemplatesModule,
    EmailSignatureModule,
    UserConfigModule,
    AiCredentialsModule,
    YubiqModule,
    RfqAnalysisModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
