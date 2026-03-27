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

  /**
   * ?admin=true: solo ADMIN — vista gestión (árbol sistema con contactos).
   * ?withSubareas=true: catálogo sistema para formulario de activaciones (todos).
   */
  @Get()
  async list(
    @CurrentUser() user: UserPayload,
    @Query('admin') admin?: string,
    @Query('withSubareas') withSubareas?: string,
  ) {
    const withDetails = admin === 'true';
    const withSubareasList = withSubareas === 'true';
    return this.areasService.findAll(user, withDetails, withSubareasList);
  }

  @Post()
  @UseGuards(AdminGuard)
  async create(@CurrentUser() user: UserPayload, @Body() dto: CreateAreaDto) {
    return this.areasService.create(user, dto);
  }

  @Get('subareas/:subAreaId/contacts')
  @UseGuards(AdminGuard)
  async listSubAreaContacts(
    @CurrentUser() user: UserPayload,
    @Param('subAreaId') subAreaId: string,
  ) {
    return this.areasService.findContactsBySubAreaId(user, subAreaId);
  }

  @Get('subareas/by-contact-email')
  async findSubAreasByContactEmail(@Query('email') email?: string) {
    return this.areasService.findSubAreasByContactEmail(email ?? '');
  }

  @Post('subareas/:subAreaId/contacts')
  @UseGuards(AdminGuard)
  async addSubAreaContact(
    @CurrentUser() user: UserPayload,
    @Param('subAreaId') subAreaId: string,
    @Body() dto: CreateSubAreaContactDto,
  ) {
    return this.areasService.addSubAreaContact(user, subAreaId, dto);
  }

  @Patch('subareas/contacts/:contactId')
  @UseGuards(AdminGuard)
  async updateSubAreaContact(
    @CurrentUser() user: UserPayload,
    @Param('contactId') contactId: string,
    @Body() dto: UpdateSubAreaContactDto,
  ) {
    return this.areasService.updateSubAreaContact(user, contactId, dto);
  }

  @Delete('subareas/contacts/:contactId')
  @UseGuards(AdminGuard)
  async removeSubAreaContact(
    @CurrentUser() user: UserPayload,
    @Param('contactId') contactId: string,
  ) {
    await this.areasService.removeSubAreaContact(user, contactId);
  }

  @Patch('subareas/:subAreaId')
  @UseGuards(AdminGuard)
  async updateSubArea(
    @CurrentUser() user: UserPayload,
    @Param('subAreaId') subAreaId: string,
    @Body() dto: UpdateSubAreaDto,
  ) {
    return this.areasService.updateSubArea(user, subAreaId, dto);
  }

  @Delete('subareas/:subAreaId')
  @UseGuards(AdminGuard)
  async removeSubArea(
    @CurrentUser() user: UserPayload,
    @Param('subAreaId') subAreaId: string,
  ) {
    await this.areasService.removeSubArea(user, subAreaId);
  }

  @Get(':id/subareas')
  @UseGuards(AdminGuard)
  async listSubAreas(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.areasService.findSubAreasByAreaId(user, id);
  }

  @Post(':id/subareas')
  @UseGuards(AdminGuard)
  async addSubArea(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: CreateSubAreaDto,
  ) {
    return this.areasService.createSubArea(user, id, dto);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  async update(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAreaDto,
  ) {
    return this.areasService.update(user, id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  async remove(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    await this.areasService.remove(user, id);
  }
}
