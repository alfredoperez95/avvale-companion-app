import { Body, Controller, Get, Param, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { GenerateSwFormDto } from './dto/generate-sw-form.dto';
import { CreateSwFormCatalogItemDto, UpdateSwFormCatalogItemDto } from './dto/sw-form-catalog-item.dto';
import { SwFormsService } from './sw-forms.service';

@Controller('sw-forms')
@UseGuards(JwtAuthGuard)
export class SwFormsController {
  constructor(private readonly swForms: SwFormsService) {}

  @Get('catalog')
  catalog() {
    return this.swForms.getCatalog();
  }

  @Get('catalog/admin')
  @UseGuards(AdminGuard)
  adminCatalog() {
    return this.swForms.listCatalogAdmin();
  }

  @Post('catalog/admin')
  @UseGuards(AdminGuard)
  createCatalogItem(@Body() dto: CreateSwFormCatalogItemDto) {
    return this.swForms.createCatalogItem(dto);
  }

  @Patch('catalog/admin/:id')
  @UseGuards(AdminGuard)
  updateCatalogItem(@Param('id') id: string, @Body() dto: UpdateSwFormCatalogItemDto) {
    return this.swForms.updateCatalogItem(id, dto);
  }

  @Post('generate')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async generate(@Body() dto: GenerateSwFormDto, @Res() res: Response) {
    const generated = await this.swForms.generate(dto);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', attachmentDisposition(generated.fileName));
    res.send(generated.buffer);
  }
}

function attachmentDisposition(fileName: string): string {
  const fallback = fileName.replace(/[^\w.\- ]+/g, '_').replace(/"/g, '');
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
