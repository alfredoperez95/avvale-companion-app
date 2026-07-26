import { Module } from '@nestjs/common';
import { ApproveSealFillerController } from './approve-seal-filler/approve-seal-filler.controller';
import { PdfExtractionService } from './approve-seal-filler/pdf-extraction.service';
import { AnthropicClientService } from './approve-seal-filler/anthropic-client.service';
import { AiCredentialsModule } from '../ai-credentials/ai-credentials.module';
import { PfeMarginExtractionService } from './approve-seal-filler/pfe-margin-extraction.service';

@Module({
  imports: [AiCredentialsModule],
  controllers: [ApproveSealFillerController],
  providers: [PdfExtractionService, AnthropicClientService, PfeMarginExtractionService],
  exports: [PdfExtractionService, AnthropicClientService, PfeMarginExtractionService],
})
export class YubiqModule {}

