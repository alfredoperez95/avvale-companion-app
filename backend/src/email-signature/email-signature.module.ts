import { Module } from '@nestjs/common';
import { EmailSignatureService } from './email-signature.service';
import { EmailSignatureController } from './email-signature.controller';

@Module({
  providers: [EmailSignatureService],
  controllers: [EmailSignatureController],
  exports: [EmailSignatureService],
})
export class EmailSignatureModule {}
