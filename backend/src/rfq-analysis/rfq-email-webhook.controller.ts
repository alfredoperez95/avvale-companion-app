import { Body, Controller, Post, ValidationPipe } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async inbound(@Body(inboundPipe) dto: RfqEmailInboundDto) {
    return this.rfq.handleInboundEmail(dto);
  }
}
