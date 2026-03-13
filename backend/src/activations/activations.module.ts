import { Module } from '@nestjs/common';
import { ActivationsService } from './activations.service';
import { ActivationsController } from './activations.controller';
import { AttachmentsModule } from '../attachments/attachments.module';

@Module({
  imports: [AttachmentsModule],
  providers: [ActivationsService],
  controllers: [ActivationsController],
  exports: [ActivationsService],
})
export class ActivationsModule {}
