import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserPayload } from '../../auth/decorators/user-payload';
import { AnthropicCredentialsService } from './anthropic-credentials.service';
import {
  AnthropicCredentialStatusResponse,
  AnthropicTestConnectionResponse,
  SetAnthropicApiKeyDto,
} from './anthropic-credentials.dto';

@Controller('user/ai-credentials/anthropic')
@UseGuards(JwtAuthGuard)
export class AnthropicCredentialsController {
  constructor(private readonly service: AnthropicCredentialsService) {}

  @Get()
  async getStatus(@CurrentUser() user: UserPayload): Promise<AnthropicCredentialStatusResponse> {
    return this.service.getStatus(user.userId);
  }

  @Post()
  async setApiKey(@CurrentUser() user: UserPayload, @Body() dto: SetAnthropicApiKeyDto) {
    return this.service.setApiKey(user.userId, dto.apiKey);
  }

  @Post('test')
  async test(@CurrentUser() user: UserPayload): Promise<AnthropicTestConnectionResponse> {
    return this.service.testConnection(user.userId);
  }
}

