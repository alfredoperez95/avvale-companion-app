import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { EmailSignatureService } from './email-signature.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { UpdateEmailSignatureDto } from './dto/update-email-signature.dto';

@Controller('email-signature')
@UseGuards(JwtAuthGuard)
export class EmailSignatureController {
  constructor(private readonly emailSignatureService: EmailSignatureService) {}

  @Get()
  async get() {
    const content = await this.emailSignatureService.getContent();
    return { content };
  }

  @Put()
  @UseGuards(AdminGuard)
  async put(@Body() dto: UpdateEmailSignatureDto) {
    return this.emailSignatureService.upsert(dto);
  }
}
