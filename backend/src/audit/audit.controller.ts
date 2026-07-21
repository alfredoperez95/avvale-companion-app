import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuditService } from './audit.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  async list(@Query() query: AuditLogQueryDto) {
    return this.audit.list(query);
  }
}
