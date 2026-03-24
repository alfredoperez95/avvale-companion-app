import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserPayload } from '../auth/decorators/user-payload';
import { UserConfigService } from './user-config.service';

@Controller('user-config')
@UseGuards(JwtAuthGuard)
export class UserConfigController {
  constructor(private readonly userConfig: UserConfigService) {}

  /** Clona plantillas, áreas y firma desde el catálogo de sistema si el usuario aún no tiene copias. */
  @Post('bootstrap')
  async bootstrap(@CurrentUser() user: UserPayload) {
    return this.userConfig.ensureUserDefaults(user.userId);
  }
}
