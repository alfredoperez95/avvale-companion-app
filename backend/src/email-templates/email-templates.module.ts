import { Module } from '@nestjs/common';
import { EmailTemplatesService } from './email-templates.service';
import { EmailTemplatesController } from './email-templates.controller';

@Module({
  providers: [EmailTemplatesService],
  controllers: [EmailTemplatesController],
  exports: [EmailTemplatesService],
})
export class EmailTemplatesModule {}
