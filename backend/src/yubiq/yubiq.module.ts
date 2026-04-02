import { Module } from '@nestjs/common';
import { ApproveSealFillerController } from './approve-seal-filler/approve-seal-filler.controller';
import { PdfExtractionService } from './approve-seal-filler/pdf-extraction.service';
import { AnthropicClientService } from './approve-seal-filler/anthropic-client.service';
import { AiCredentialsModule } from '../ai-credentials/ai-credentials.module';

@Module({
  imports: [AiCredentialsModule],
  controllers: [ApproveSealFillerController],
  providers: [PdfExtractionService, AnthropicClientService],
  exports: [PdfExtractionService],
})
export class YubiqModule {}

