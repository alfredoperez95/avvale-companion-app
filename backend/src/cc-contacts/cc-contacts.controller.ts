import { Controller, Get, UseGuards } from '@nestjs/common';
import { CcContactsService } from './cc-contacts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('cc-contacts')
@UseGuards(JwtAuthGuard)
export class CcContactsController {
  constructor(private readonly ccContactsService: CcContactsService) {}

  @Get()
  list() {
    return this.ccContactsService.findAll();
  }
}
