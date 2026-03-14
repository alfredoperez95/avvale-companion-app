import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { EmailTemplatesService } from './email-templates.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CreateEmailTemplateDto } from './dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';

@Controller('email-templates')
@UseGuards(JwtAuthGuard)
export class EmailTemplatesController {
  constructor(private readonly emailTemplatesService: EmailTemplatesService) {}

  @Get()
  list() {
    return this.emailTemplatesService.findAll();
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: CreateEmailTemplateDto) {
    return this.emailTemplatesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id') id: string, @Body() dto: UpdateEmailTemplateDto) {
    return this.emailTemplatesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  async remove(@Param('id') id: string) {
    await this.emailTemplatesService.remove(id);
  }
}
