import { Module } from '@nestjs/common';
import { MeddpiccController } from './meddpicc.controller';
import { MeddpiccConvaiWebhookController } from './meddpicc-convai-webhook.controller';
import { MeddpiccService } from './meddpicc.service';
import { MeddpiccStorageService } from './meddpicc-storage.service';
import { MeddpiccExtractService } from './meddpicc-extract.service';
import { YubiqModule } from '../yubiq/yubiq.module';
import { AiCredentialsModule } from '../ai-credentials/ai-credentials.module';

@Module({
  imports: [YubiqModule, AiCredentialsModule],
  controllers: [MeddpiccController, MeddpiccConvaiWebhookController],
  providers: [MeddpiccService, MeddpiccStorageService, MeddpiccExtractService],
})
export class MeddpiccModule {}
