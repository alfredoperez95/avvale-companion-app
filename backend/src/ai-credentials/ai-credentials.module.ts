import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { AnthropicCredentialsController } from './anthropic/anthropic-credentials.controller';
import { AnthropicCredentialsService } from './anthropic/anthropic-credentials.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [AnthropicCredentialsController],
  providers: [AnthropicCredentialsService],
  exports: [AnthropicCredentialsService],
})
export class AiCredentialsModule {}

