import { Module } from '@nestjs/common';
import { AttachmentsService } from './attachments.service';
import { PublicAttachmentsController } from './public-attachments.controller';
import { ExtensionsController } from './extensions.controller';

@Module({
  providers: [AttachmentsService],
  controllers: [PublicAttachmentsController, ExtensionsController],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
