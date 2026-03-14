import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { CcContactsService } from './cc-contacts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CreateCcContactDto } from './dto/create-cc-contact.dto';
import { UpdateCcContactDto } from './dto/update-cc-contact.dto';

@Controller('cc-contacts')
@UseGuards(JwtAuthGuard)
export class CcContactsController {
  constructor(private readonly ccContactsService: CcContactsService) {}

  @Get()
  list() {
    return this.ccContactsService.findAll();
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: CreateCcContactDto) {
    return this.ccContactsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id') id: string, @Body() dto: UpdateCcContactDto) {
    return this.ccContactsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  async remove(@Param('id') id: string) {
    await this.ccContactsService.remove(id);
  }
}
