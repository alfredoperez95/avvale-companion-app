import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AreasService } from './areas.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserPayload } from '../auth/decorators/user-payload';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';
import { CreateAreaContactDto } from './dto/create-area-contact.dto';
import { UpdateAreaContactDto } from './dto/update-area-contact.dto';

@Controller('areas')
@UseGuards(JwtAuthGuard)
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  /** Lista áreas. Si ?admin=true y el usuario es ADMIN, incluye contactos. */
  @Get()
  async list(
    @CurrentUser() user: UserPayload,
    @Query('admin') admin?: string,
  ) {
    const withContacts = admin === 'true' && user.role === 'ADMIN';
    return this.areasService.findAll(withContacts);
  }

  @Post()
  @UseGuards(AdminGuard)
  async create(@Body() dto: CreateAreaDto) {
    return this.areasService.create(dto);
  }

  @Get(':id/contacts')
  @UseGuards(AdminGuard)
  async listContacts(@Param('id') id: string) {
    return this.areasService.findContactsByAreaId(id);
  }

  @Post(':id/contacts')
  @UseGuards(AdminGuard)
  async addContact(
    @Param('id') id: string,
    @Body() dto: CreateAreaContactDto,
  ) {
    return this.areasService.addContact(id, dto);
  }

  @Patch('contacts/:contactId')
  @UseGuards(AdminGuard)
  async updateContact(
    @Param('contactId') contactId: string,
    @Body() dto: UpdateAreaContactDto,
  ) {
    return this.areasService.updateContact(contactId, dto);
  }

  @Delete('contacts/:contactId')
  @UseGuards(AdminGuard)
  async removeContact(@Param('contactId') contactId: string) {
    await this.areasService.removeContact(contactId);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  async update(@Param('id') id: string, @Body() dto: UpdateAreaDto) {
    return this.areasService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  async remove(@Param('id') id: string) {
    await this.areasService.remove(id);
  }
}
