import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Controller('contacts')
@UseGuards(JwtAuthGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  /**
   * Lista contactos CC (usuario autenticado).
   * - Sin query o `fields=name,email`: array `{ id, name, email, isProjectJp }[]` (orden por nombre).
   * - `?fields=email`: `{ emails: string[] }`
   * - `?fields=name`: `{ names: string[] }`
   */
  @Get()
  list(@Query('fields') fields?: string) {
    return this.contactsService.findAll(fields);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: CreateContactDto) {
    return this.contactsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id') id: string, @Body() dto: UpdateContactDto) {
    return this.contactsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  async remove(@Param('id') id: string) {
    await this.contactsService.remove(id);
  }
}
