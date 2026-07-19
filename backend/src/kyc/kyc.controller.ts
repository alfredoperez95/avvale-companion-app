import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserPayload } from '../auth/decorators/user-payload';
import { KycService } from './kyc.service';
import { KycLinkedInProfileDto } from './dto/kyc-linkedin-profile.dto';
import {
  BulkDeleteKycCompaniesDto,
  CreateKycCompanyDto,
  ImportKycCompaniesDto,
} from './dto/kyc-company.dto';
import { CreateKycChatSessionDto, StreamKycChatDto } from './dto/kyc-chat.dto';

/**
 * Extensión LinkedIn → organigrama (JWT Bearer):
 * - GET /kyc/clients?q= — { clients: [{ id, name }] }
 * - POST /kyc/linkedin-profile — 201 { orgMemberId, contactId }; 400/404/409 según validación.
 * CORS no aplica al SW de la extensión si el token va en Authorization.
 */
@Controller('kyc')
@UseGuards(JwtAuthGuard)
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @Get('clients')
  listClientsForExtension(@Query('q') q?: string) {
    return this.kyc.listClientsForExtension(q);
  }

  @Post('linkedin-profile')
  @HttpCode(201)
  ingestLinkedInProfile(@Body() body: KycLinkedInProfileDto) {
    return this.kyc.ingestLinkedInOrgProfile(body);
  }

  @Get('companies')
  listCompanies(
    @Query('q') q?: string,
    @Query('strategic') strategic?: string,
    @Query('all') all?: string,
    @Query('industry') industry?: string,
  ) {
    return this.kyc.listCompanies({ q, strategic, all, industry });
  }

  @Post('companies')
  create(@Body() body: CreateKycCompanyDto, @CurrentUser() user: UserPayload) {
    return this.kyc.createCompany(
      body,
      user.userId,
    );
  }

  @Post('companies/bulk-delete')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  bulkDelete(@Body() body: BulkDeleteKycCompaniesDto) {
    return this.kyc.bulkDeleteCompanyProfiles(body?.ids ?? []);
  }

  @Post('companies/import')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  importCo(@Body() body: ImportKycCompaniesDto) {
    return this.kyc.importCompanies(body?.companies ?? []);
  }

  @Get('companies/:id')
  getOne(@Param('id') id: string) {
    return this.kyc.getCompanyOrThrow(id);
  }

  @Patch('companies/:id')
  patchCompany(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.kyc.patchCompany(BigInt(id), body);
  }

  @Delete('companies/:id')
  @HttpCode(200)
  delOne(@Param('id') id: string) {
    return this.kyc.deleteKycDataForCompany(BigInt(id));
  }

  @Post('companies/:id/activate')
  @HttpCode(201)
  activate(@Param('id') id: string) {
    return this.kyc.ensureActivate(BigInt(id));
  }

  @Patch('companies/:id/profile')
  async patchProfile(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-kyc-avvale-projects-explicit') projectsExplicit?: string,
  ) {
    const pe = (projectsExplicit ?? '').trim().toLowerCase();
    const explicit = pe === '1' || pe === 'true' || pe === 'yes';
    return this.kyc.patchProfile(BigInt(id), body, { avvaleProjectsExplicit: explicit });
  }

  @Post('companies/:id/profile/synthesize-summary')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  synthesizeSummary(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.kyc.synthesizeExecutiveSummary(BigInt(id), user.userId);
  }

  /** Traducción EN del contenido del informe estático (Anthropic; misma clave que chat KYC). */
  @Post('companies/:id/report-translate-en')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  translateReportEn(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.kyc.translateReportToEnglish(BigInt(id), user.userId);
  }

  @Get('companies/:id/timeline')
  timeline(@Param('id') id: string) {
    return this.kyc.getTimeline(BigInt(id));
  }

  @Post('companies/:id/enrich')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  enrich(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.kyc.enrichCompany(BigInt(id), user.userId);
  }

  @Get('companies/:id/org')
  org(@Param('id') id: string) {
    return this.kyc.getOrg(BigInt(id));
  }

  @Post('companies/:id/org/members')
  @HttpCode(201)
  addMem(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.kyc.addOrgMember(BigInt(id), body);
  }

  @Patch('org/members/:id')
  patchMem(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.kyc.patchMember(BigInt(id), body);
  }

  @Delete('org/members/:id')
  @HttpCode(200)
  delMem(@Param('id') id: string) {
    return this.kyc.deleteMember(BigInt(id));
  }

  @Post('companies/:id/org/relationships')
  @HttpCode(201)
  addRel(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.kyc.addRelationship(BigInt(id), body);
  }

  @Delete('org/relationships/:id')
  @HttpCode(200)
  delRel(@Param('id') id: string) {
    return this.kyc.deleteRel(BigInt(id));
  }

  @Get('companies/:id/signals')
  signals(@Param('id') id: string) {
    return this.kyc.getSignals(BigInt(id));
  }

  @Post('companies/:id/signals')
  @HttpCode(201)
  addSig(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.kyc.addSignal(BigInt(id), body);
  }

  @Post('companies/:id/signals/fetch-news')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  fetchNews(@Param('id') id: string) {
    return this.kyc.fetchNewsSignals(BigInt(id));
  }

  @Post('companies/:id/signals/infer-hypotheses')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  inferSignalHypotheses(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.kyc.inferSignalHypotheses(BigInt(id), user.userId);
  }

  @Get('companies/:id/open-questions')
  openList(@Param('id') id: string, @Query('status') status?: string) {
    return this.kyc.getOpenQuestions(BigInt(id), status ?? 'open');
  }

  @Post('companies/:id/open-questions')
  @HttpCode(201)
  openAdd(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.kyc.addOpenQuestion(BigInt(id), body);
  }

  @Patch('open-questions/:id')
  openPatch(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.kyc.patchOpenQuestion(BigInt(id), body);
  }

  @Delete('open-questions/:id')
  @HttpCode(200)
  openDel(@Param('id') id: string) {
    return this.kyc.deleteOpenQuestion(BigInt(id));
  }

  @Get('companies/:id/chat/sessions')
  sessions(@Param('id') id: string) {
    return this.kyc.getChatSessions(BigInt(id));
  }

  @Post('companies/:id/chat/sessions')
  @HttpCode(201)
  newSession(
    @Param('id') id: string,
    @CurrentUser() user: UserPayload,
    @Body() body: CreateKycChatSessionDto,
  ) {
    return this.kyc.createChatSession(BigInt(id), user.userId, body ?? {});
  }

  @Get('chat/sessions/:sessionId/messages')
  msgs(@Param('sessionId') sessionId: string) {
    return this.kyc.getChatMessages(BigInt(sessionId));
  }

  @Post('chat/sessions/:sessionId/stream')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async stream(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: UserPayload,
    @Body() body: StreamKycChatDto,
    @Res() res: Response,
  ) {
    return this.kyc.streamChat(BigInt(sessionId), user.userId, res, body.message);
  }
}
