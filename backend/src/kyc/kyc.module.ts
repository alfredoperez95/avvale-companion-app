import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AiCredentialsModule } from '../ai-credentials/ai-credentials.module';
import { YubiqModule } from '../yubiq/yubiq.module';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';

@Module({
  imports: [ConfigModule, PrismaModule, AiCredentialsModule, YubiqModule],
  controllers: [KycController],
  providers: [KycService],
})
export class KycModule {}
