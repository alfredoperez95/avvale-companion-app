import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ActivationsService } from './activations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserPayload } from '../auth/decorators/user-payload';
import { ActivationStatus } from '@prisma/client';

@Controller('activations')
@UseGuards(JwtAuthGuard)
export class ActivationsController {
  constructor(private readonly activationsService: ActivationsService) {}

  @Get()
  async list(@CurrentUser() user: UserPayload, @Query('status') status?: ActivationStatus) {
    return this.activationsService.findAllByUser(user.userId, { status });
  }

  @Get(':id')
  async getOne(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.activationsService.findOneByIdAndUser(id, user.userId);
  }
}
