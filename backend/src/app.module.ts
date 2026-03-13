import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ActivationsModule } from './activations/activations.module';
import { AreasModule } from './areas/areas.module';
import { CcContactsModule } from './cc-contacts/cc-contacts.module';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ActivationsModule,
    AreasModule,
    CcContactsModule,
    UploadsModule,
  ],
})
export class AppModule {}
