import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserPayload } from '../auth/decorators/user-payload';
import { MeddpiccService } from './meddpicc.service';
import { CreateMeddpiccDealDto } from './dto/create-meddpicc-deal.dto';
import { UpdateMeddpiccDealDto } from './dto/update-meddpicc-deal.dto';
import { AnalyzeMeddpiccDealDto } from './dto/analyze-meddpicc-deal.dto';
import { ClientConvaiTranscriptDto } from './dto/client-convai-transcript.dto';
import { FetchElevenlabsConversationDto } from './dto/fetch-elevenlabs-conversation.dto';

@Controller('meddpicc/deals')
@UseGuards(JwtAuthGuard)
export class MeddpiccController {
  constructor(private readonly meddpicc: MeddpiccService) {}

  @Get()
  list(
    @CurrentUser() user: UserPayload,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
  ) {
    return this.meddpicc.list(user, { status, userId });
  }

  @Get('stats')
  stats(@CurrentUser() user: UserPayload) {
    return this.meddpicc.stats(user);
  }

  @Post()
  create(@CurrentUser() user: UserPayload, @Body() dto: CreateMeddpiccDealDto) {
    return this.meddpicc.create(user, dto);
  }

  @Post(':id/attachments')
  @UseInterceptors(
    FilesInterceptor('files', 15, {
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  addAttachments(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ) {
    return this.meddpicc.addAttachments(user, id, files ?? []);
  }

  @Delete(':id/attachments/:attachmentId')
  removeAttachment(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.meddpicc.removeAttachment(user, id, attachmentId);
  }

  @Get(':id')
  getOne(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.meddpicc.getOne(user, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: UserPayload, @Param('id') id: string, @Body() dto: UpdateMeddpiccDealDto) {
    return this.meddpicc.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.meddpicc.remove(user, id);
  }

  @Post(':id/analyze')
  analyze(@CurrentUser() user: UserPayload, @Param('id') id: string, @Body() dto: AnalyzeMeddpiccDealDto) {
    return this.meddpicc.analyze(user, id, dto);
  }

  /**
   * Debug local: simula un evento `post_call_transcription` (sin HMAC) para verificar qué persiste el backend.
   * Protegido por JWT y además requiere `ALLOW_CONVAI_WEBHOOK_SIMULATE=true`.
   */
  @Post(':id/convai/simulate-post-call')
  simulateConvaiPostCall(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.meddpicc.simulateConvaiPostCall(user, id);
  }

  /**
   * Guarda transcripción (y opcionalmente resumen) desde el navegador si el webhook post-llamada no llegó.
   */
  @Post(':id/convai/client-transcript')
  applyClientConvaiTranscript(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: ClientConvaiTranscriptDto,
  ) {
    return this.meddpicc.applyClientConvaiTranscript(user, id, dto);
  }

  /**
   * Obtiene la conversación desde la API de ElevenLabs (GET /v1/convai/conversations/…) y la persiste como el webhook.
   * Requiere `ELEVENLABS_API_KEY` en el backend (xi-api-key).
   */
  @Post(':id/convai/import-from-elevenlabs')
  importConvaiFromElevenLabs(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: FetchElevenlabsConversationDto,
  ) {
    return this.meddpicc.importConvaiFromElevenLabsApi(user, id, dto.conversationId);
  }
}
