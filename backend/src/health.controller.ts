import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from './auth/decorators/public.decorator';

@Controller('health')
@SkipThrottle()
@Public()
export class HealthController {
  @Get()
  legacy() {
    return this.live();
  }

  @Get('live')
  check() {
    return this.live();
  }

  private live() {
    return { status: 'ok' };
  }
}
