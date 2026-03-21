import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';
import { ActivationsService } from './activations.service';
import { ActivationsController } from './activations.controller';
import { AttachmentsModule } from '../attachments/attachments.module';
import { BillingAdminContactsModule } from '../billing-admin-contacts/billing-admin-contacts.module';
import { MakeModule } from '../make/make.module';
import { EmailSignatureModule } from '../email-signature/email-signature.module';

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

@Module({
  imports: [
    AttachmentsModule,
    BillingAdminContactsModule,
    MakeModule,
    EmailSignatureModule,
    MulterModule.register({
      storage: multer.memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  ],
  providers: [ActivationsService],
  controllers: [ActivationsController],
  exports: [ActivationsService],
})
export class ActivationsModule {}
