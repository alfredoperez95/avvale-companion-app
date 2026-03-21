import { Body, Controller, Post } from '@nestjs/common';
import { MakeService } from './make.service';
import { MakeCallbackDto } from './dto/make-callback.dto';

@Controller('webhooks/make')
export class MakeCallbackController {
  constructor(private readonly makeService: MakeService) {}

  @Post('callback')
  async callback(@Body() dto: MakeCallbackDto) {
    await this.makeService.handleActivationCallback(dto);
    return { ok: true };
  }
}
