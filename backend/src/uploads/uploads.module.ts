import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';
import { UploadsController } from './uploads.controller';
import { AttachmentsModule } from '../attachments/attachments.module';

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

@Module({
  imports: [
    AttachmentsModule,
    MulterModule.register({
      storage: multer.memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  ],
  controllers: [UploadsController],
})
export class UploadsModule {}

