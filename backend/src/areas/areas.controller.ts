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

  /**
   * ?admin=true: vista gestión (ADMIN → árbol sistema; USER → árbol propio con contactos).
   * ?withSubareas=true: áreas del usuario con subáreas para el formulario de activaciones.
   */
  @Get()
  async list(
    @CurrentUser() user: UserPayload,
    @Query('admin') admin?: string,
    @Query('withSubareas') withSubareas?: string,
    /** Solo ADMIN: con admin=true, lista el árbol personal enriquecido en lugar del catálogo sistema. */
    @Query('personal') personal?: string,
  ) {
    const withDetails = admin === 'true';
    const withSubareasList = withSubareas === 'true';
    const personalCatalog = personal === 'true';
    return this.areasService.findAll(user, withDetails, withSubareasList, personalCatalog);
  }

  /** ?system=true solo ADMIN: crea área en catálogo sistema (owner null). */
  @Post()
  async create(
    @CurrentUser() user: UserPayload,
    @Body() dto: CreateAreaDto,
    @Query('system') system?: string,
  ) {
    const systemCatalog = system === 'true';
    return this.areasService.create(user, dto, systemCatalog);
  }

  @Get('subareas/:subAreaId/contacts')
  async listSubAreaContacts(
    @CurrentUser() user: UserPayload,
    @Param('subAreaId') subAreaId: string,
  ) {
    return this.areasService.findContactsBySubAreaId(user, subAreaId);
  }

  @Post('subareas/:subAreaId/contacts')
  async addSubAreaContact(
    @CurrentUser() user: UserPayload,
    @Param('subAreaId') subAreaId: string,
    @Body() dto: CreateSubAreaContactDto,
  ) {
    return this.areasService.addSubAreaContact(user, subAreaId, dto);
  }

  @Patch('subareas/contacts/:contactId')
  async updateSubAreaContact(
    @CurrentUser() user: UserPayload,
    @Param('contactId') contactId: string,
    @Body() dto: UpdateSubAreaContactDto,
  ) {
    return this.areasService.updateSubAreaContact(user, contactId, dto);
  }

  @Delete('subareas/contacts/:contactId')
  async removeSubAreaContact(
    @CurrentUser() user: UserPayload,
    @Param('contactId') contactId: string,
  ) {
    await this.areasService.removeSubAreaContact(user, contactId);
  }

  @Patch('subareas/:subAreaId')
  async updateSubArea(
    @CurrentUser() user: UserPayload,
    @Param('subAreaId') subAreaId: string,
    @Body() dto: UpdateSubAreaDto,
  ) {
    return this.areasService.updateSubArea(user, subAreaId, dto);
  }

  @Delete('subareas/:subAreaId')
  async removeSubArea(
    @CurrentUser() user: UserPayload,
    @Param('subAreaId') subAreaId: string,
  ) {
    await this.areasService.removeSubArea(user, subAreaId);
  }

  @Get(':id/subareas')
  async listSubAreas(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.areasService.findSubAreasByAreaId(user, id);
  }

  @Post(':id/subareas')
  async addSubArea(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: CreateSubAreaDto,
  ) {
    return this.areasService.createSubArea(user, id, dto);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAreaDto,
  ) {
    return this.areasService.update(user, id, dto);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    await this.areasService.remove(user, id);
  }
}
