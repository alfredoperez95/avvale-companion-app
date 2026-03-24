import { Body, Controller, ForbiddenException, Get, Put, Query, UseGuards } from '@nestjs/common';
import { EmailSignatureService } from './email-signature.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserPayload } from '../auth/decorators/user-payload';
import { UpdateEmailSignatureDto } from './dto/update-email-signature.dto';

@Controller('email-signature')
@UseGuards(JwtAuthGuard)
export class EmailSignatureController {
  constructor(private readonly emailSignatureService: EmailSignatureService) {}

  /** ?scope=system solo ADMIN: plantilla de firma para nuevos usuarios. */
  @Get()
  async get(@CurrentUser() user: UserPayload, @Query('scope') scope?: string) {
    if (scope === 'system') {
      if (user.role !== 'ADMIN') throw new ForbiddenException();
      const content = await this.emailSignatureService.getSystemTemplateContent();
      return { content };
    }
    const content = await this.emailSignatureService.getContent(user.userId);
    return { content };
  }

  @Put()
  async put(
    @CurrentUser() user: UserPayload,
    @Body() dto: UpdateEmailSignatureDto,
    @Query('scope') scope?: string,
  ) {
    if (scope === 'system') {
      if (user.role !== 'ADMIN') throw new ForbiddenException();
      return this.emailSignatureService.upsertSystemTemplate(dto);
    }
    return this.emailSignatureService.upsertForUser(user.userId, dto);
  }
}
