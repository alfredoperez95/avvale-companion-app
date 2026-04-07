import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CreateUserByAdminDto } from './dto/create-user-by-admin.dto';
import { UpdateUserByAdminDto } from './dto/update-user-by-admin.dto';
import { InviteUserDto } from '../invitations/dto/invite-user.dto';
import { InvitationsService } from '../invitations/invitations.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserPayload } from '../auth/decorators/user-payload';

@Controller('users')
@UseGuards(JwtAuthGuard, AdminGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly invitationsService: InvitationsService,
  ) {}

  @Get()
  async list() {
    return this.usersService.findAll();
  }

  @Post()
  async create(@Body() dto: CreateUserByAdminDto) {
    return this.usersService.createByAdmin(dto);
  }

  @Post('invite')
  @UseGuards(ThrottlerGuard)
  @Throttle({ 'magic-link': { limit: 20, ttl: 60_000 } })
  async invite(@CurrentUser() payload: UserPayload, @Body() dto: InviteUserDto) {
    return this.invitationsService.createAndSendInvite(dto, payload.userId);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserByAdminDto) {
    return this.usersService.updateByAdmin(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() payload: UserPayload) {
    await this.usersService.deleteByAdmin(id, payload.userId);
  }
}
