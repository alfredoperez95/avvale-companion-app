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
import { CreateSubAreaDto } from './dto/create-sub-area.dto';
import { UpdateSubAreaDto } from './dto/update-sub-area.dto';
import { CreateSubAreaContactDto } from './dto/create-sub-area-contact.dto';
import { UpdateSubAreaContactDto } from './dto/update-sub-area-contact.dto';

@Controller('areas')
@UseGuards(JwtAuthGuard)
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  /** Lista áreas. ?admin=true (ADMIN): director, subáreas y contactos. ?withSubareas=true: áreas con subAreas id+name (formulario activaciones). */
  @Get()
  async list(
    @CurrentUser() user: UserPayload,
    @Query('admin') admin?: string,
    @Query('withSubareas') withSubareas?: string,
  ) {
    const withDetails = admin === 'true' && user.role === 'ADMIN';
    const withSubareasList = withSubareas === 'true';
    return this.areasService.findAll(withDetails, withSubareasList);
  }

  @Post()
  @UseGuards(AdminGuard)
  async create(@Body() dto: CreateAreaDto) {
    return this.areasService.create(dto);
  }

  // Rutas con segmento fijo "subareas" antes de :id para que no se matchee como id

  @Get('subareas/:subAreaId/contacts')
  @UseGuards(AdminGuard)
  async listSubAreaContacts(@Param('subAreaId') subAreaId: string) {
    return this.areasService.findContactsBySubAreaId(subAreaId);
  }

  @Post('subareas/:subAreaId/contacts')
  @UseGuards(AdminGuard)
  async addSubAreaContact(
    @Param('subAreaId') subAreaId: string,
    @Body() dto: CreateSubAreaContactDto,
  ) {
    return this.areasService.addSubAreaContact(subAreaId, dto);
  }

  @Patch('subareas/contacts/:contactId')
  @UseGuards(AdminGuard)
  async updateSubAreaContact(
    @Param('contactId') contactId: string,
    @Body() dto: UpdateSubAreaContactDto,
  ) {
    return this.areasService.updateSubAreaContact(contactId, dto);
  }

  @Delete('subareas/contacts/:contactId')
  @UseGuards(AdminGuard)
  async removeSubAreaContact(@Param('contactId') contactId: string) {
    await this.areasService.removeSubAreaContact(contactId);
  }

  @Patch('subareas/:subAreaId')
  @UseGuards(AdminGuard)
  async updateSubArea(
    @Param('subAreaId') subAreaId: string,
    @Body() dto: UpdateSubAreaDto,
  ) {
    return this.areasService.updateSubArea(subAreaId, dto);
  }

  @Delete('subareas/:subAreaId')
  @UseGuards(AdminGuard)
  async removeSubArea(@Param('subAreaId') subAreaId: string) {
    await this.areasService.removeSubArea(subAreaId);
  }

  @Get(':id/subareas')
  @UseGuards(AdminGuard)
  async listSubAreas(@Param('id') id: string) {
    return this.areasService.findSubAreasByAreaId(id);
  }

  @Post(':id/subareas')
  @UseGuards(AdminGuard)
  async addSubArea(
    @Param('id') id: string,
    @Body() dto: CreateSubAreaDto,
  ) {
    return this.areasService.createSubArea(id, dto);
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
