import { Body, Controller, Post, ValidationPipe } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ExpenseEmailInboundDto } from './dto/expense-email-inbound.dto';
import { ExpensesService } from './expenses.service';

const inboundPipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: false,
});

@Controller('webhooks/expense-email')
export class ExpenseEmailWebhookController {
  constructor(private readonly expenses: ExpensesService) {}

  @Post('inbound')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async inbound(@Body(inboundPipe) dto: ExpenseEmailInboundDto) {
    return this.expenses.handleInboundEmail(dto);
  }
}
