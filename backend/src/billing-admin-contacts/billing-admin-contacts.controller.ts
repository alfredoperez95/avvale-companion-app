import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { BillingAdminContactsService } from './billing-admin-contacts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CreateBillingAdminContactDto } from './dto/create-billing-admin-contact.dto';
import { UpdateBillingAdminContactDto } from './dto/update-billing-admin-contact.dto';

@Controller('billing-admin-contacts')
@UseGuards(JwtAuthGuard)
export class BillingAdminContactsController {
  constructor(private readonly billingAdminContactsService: BillingAdminContactsService) {}

  @Get()
  list() {
    return this.billingAdminContactsService.findAll();
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: CreateBillingAdminContactDto) {
    return this.billingAdminContactsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id') id: string, @Body() dto: UpdateBillingAdminContactDto) {
    return this.billingAdminContactsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  async remove(@Param('id') id: string) {
    await this.billingAdminContactsService.remove(id);
  }
}
