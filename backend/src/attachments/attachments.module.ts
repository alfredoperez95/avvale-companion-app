import { Module } from '@nestjs/common';
import { AttachmentsService } from './attachments.service';
import { PublicAttachmentsController } from './public-attachments.controller';

@Module({
  providers: [AttachmentsService],
  controllers: [PublicAttachmentsController],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
