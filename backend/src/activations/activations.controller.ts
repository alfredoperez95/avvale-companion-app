import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ActivationsService } from './activations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserPayload } from '../auth/decorators/user-payload';
import { ActivationStatus } from '@prisma/client';
import { CreateActivationDto } from './dto/create-activation.dto';

@Controller('activations')
@UseGuards(JwtAuthGuard)
export class ActivationsController {
  constructor(private readonly activationsService: ActivationsService) {}

  @Post()
  async create(@CurrentUser() user: UserPayload, @Body() dto: CreateActivationDto) {
    const createdByLabel = user.email;
    return this.activationsService.create(user.userId, createdByLabel, dto);
  }

  @Get()
  async list(@CurrentUser() user: UserPayload, @Query('status') status?: ActivationStatus) {
    return this.activationsService.findAllByUser(user.userId, { status });
  }

  @Get(':id')
  async getOne(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.activationsService.findOneByIdAndUser(id, user.userId);
  }

  @Post(':id/send')
  async send(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.activationsService.requestSend(id, user.userId);
  }
}
