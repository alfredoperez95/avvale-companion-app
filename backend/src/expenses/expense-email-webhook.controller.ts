import { Body, Controller, Post, ValidationPipe } from '@nestjs/common';
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
  async inbound(@Body(inboundPipe) dto: ExpenseEmailInboundDto) {
    return this.expenses.handleInboundEmail(dto);
  }
}
