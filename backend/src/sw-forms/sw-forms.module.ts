import { Module } from '@nestjs/common';
import { SwFormsController } from './sw-forms.controller';
import { SwFormsService } from './sw-forms.service';

@Module({
  controllers: [SwFormsController],
  providers: [SwFormsService],
})
export class SwFormsModule {}
