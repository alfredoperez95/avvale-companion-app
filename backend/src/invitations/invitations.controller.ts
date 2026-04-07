import { Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { InvitationsService } from './invitations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('invitations')
@UseGuards(JwtAuthGuard, AdminGuard)
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Get()
  list() {
    return this.invitationsService.listForAdmin();
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.invitationsService.deleteByAdmin(id);
  }

  @Post(':id/resend')
  @UseGuards(ThrottlerGuard)
  @Throttle({ 'magic-link': { limit: 20, ttl: 60_000 } })
  resend(@Param('id') id: string) {
    return this.invitationsService.resendByAdmin(id);
  }
}
