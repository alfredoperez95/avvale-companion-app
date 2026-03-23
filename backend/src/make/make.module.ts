import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MakeService } from './make.service';
import { MakeCallbackController } from './make-callback.controller';
import { AttachmentsModule } from '../attachments/attachments.module';

@Module({
  imports: [PrismaModule, AttachmentsModule],
  providers: [MakeService],
  controllers: [MakeCallbackController],
  exports: [MakeService],
})
export class MakeModule {}
