import { Module } from '@nestjs/common';
import { ActivationsService } from './activations.service';
import { ActivationsController } from './activations.controller';

@Module({
  providers: [ActivationsService],
  controllers: [ActivationsController],
  exports: [ActivationsService],
})
export class ActivationsModule {}
