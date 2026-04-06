import { Body, Controller, Post, ValidationPipe } from '@nestjs/common';
import { RfqAnalysisService } from './rfq-analysis.service';
import { RfqEmailInboundDto } from './dto/rfq-email-inbound.dto';

const inboundPipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: false,
});

@Controller('webhooks/rfq-email')
export class RfqEmailWebhookController {
  constructor(private readonly rfq: RfqAnalysisService) {}

  @Post('inbound')
  async inbound(@Body(inboundPipe) dto: RfqEmailInboundDto) {
    return this.rfq.handleInboundEmail(dto);
  }
}
