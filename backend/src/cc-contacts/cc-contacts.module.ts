import { Module } from '@nestjs/common';
import { CcContactsService } from './cc-contacts.service';
import { CcContactsController } from './cc-contacts.controller';

@Module({
  providers: [CcContactsService],
  controllers: [CcContactsController],
  exports: [CcContactsService],
})
export class CcContactsModule {}
