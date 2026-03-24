import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Query } from '@nestjs/common';
import { EmailTemplatesService } from './email-templates.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserPayload } from '../auth/decorators/user-payload';
import { CreateEmailTemplateDto } from './dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';

@Controller('email-templates')
@UseGuards(JwtAuthGuard)
export class EmailTemplatesController {
  constructor(private readonly emailTemplatesService: EmailTemplatesService) {}

  /** ?scope=system solo ADMIN: lista plantillas globales. */
  @Get()
  list(@CurrentUser() user: UserPayload, @Query('scope') scope?: string) {
    return this.emailTemplatesService.findAll(user, scope === 'system');
  }

  /** Reemplaza las plantillas personales del usuario por copias del catálogo de sistema actual. */
  @Post('restore-from-system')
  restoreFromSystem(@CurrentUser() user: UserPayload) {
    return this.emailTemplatesService.restorePersonalFromSystem(user);
  }

  /** ?system=true solo ADMIN: crea plantilla global (userId null). */
  @Post()
  create(
    @CurrentUser() user: UserPayload,
    @Body() dto: CreateEmailTemplateDto,
    @Query('system') system?: string,
  ) {
    return this.emailTemplatesService.create(user, dto, system === 'true');
  }

  @Patch(':id')
  update(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateEmailTemplateDto,
  ) {
    return this.emailTemplatesService.update(user, id, dto);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    await this.emailTemplatesService.remove(user, id);
  }
}
