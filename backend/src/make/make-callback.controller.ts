import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MakeService } from './make.service';
import { MakeCallbackDto } from './dto/make-callback.dto';

@Controller('webhooks/make')
export class MakeCallbackController {
  constructor(private readonly makeService: MakeService) {}

  @Post('callback')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async callback(@Body() dto: MakeCallbackDto) {
    await this.makeService.handleActivationCallback(dto);
    return { ok: true };
  }
}
