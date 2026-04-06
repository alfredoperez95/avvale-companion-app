import { Module, forwardRef } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';
import { QueueModule } from '../queue/queue.module';
import { YubiqModule } from '../yubiq/yubiq.module';
import { AiCredentialsModule } from '../ai-credentials/ai-credentials.module';
import { RfqAnalysisService } from './rfq-analysis.service';
import { RfqStorageService } from './rfq-storage.service';
import { RfqPipelineService } from './rfq-pipeline.service';
import { RfqAnalysisController } from './rfq-analysis.controller';
import { RfqEmailWebhookController } from './rfq-email-webhook.controller';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

@Module({
  imports: [
    forwardRef(() => QueueModule),
    YubiqModule,
    AiCredentialsModule,
    MulterModule.register({
      storage: multer.memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  ],
  controllers: [RfqAnalysisController, RfqEmailWebhookController],
  providers: [RfqAnalysisService, RfqStorageService, RfqPipelineService],
  exports: [RfqAnalysisService, RfqPipelineService],
})
export class RfqAnalysisModule {}
