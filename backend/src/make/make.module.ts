import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MakeService } from './make.service';
import { MakeCallbackController } from './make-callback.controller';

@Module({
  imports: [PrismaModule],
  providers: [MakeService],
  controllers: [MakeCallbackController],
  exports: [MakeService],
})
export class MakeModule {}
