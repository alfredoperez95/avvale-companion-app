import { Module } from '@nestjs/common';
import { BillingAdminContactsService } from './billing-admin-contacts.service';
import { BillingAdminContactsController } from './billing-admin-contacts.controller';

@Module({
  controllers: [BillingAdminContactsController],
  providers: [BillingAdminContactsService],
  exports: [BillingAdminContactsService],
})
export class BillingAdminContactsModule {}
