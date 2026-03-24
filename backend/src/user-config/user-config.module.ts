import { Module } from '@nestjs/common';
import { UserConfigController } from './user-config.controller';
import { UserConfigService } from './user-config.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UserConfigController],
  providers: [UserConfigService],
  exports: [UserConfigService],
})
export class UserConfigModule {}
