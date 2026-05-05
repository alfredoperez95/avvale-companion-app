import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserPayload } from '../auth/decorators/user-payload';
import { KycService } from './kyc.service';

@Controller('kyc')
@UseGuards(JwtAuthGuard, AdminGuard)
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @Get('companies')
  listCompanies(
    @Query('q') q?: string,
    @Query('strategic') strategic?: string,
    @Query('all') all?: string,
  ) {
    return this.kyc.listCompanies({ q, strategic, all });
  }

  @Post('companies')
  create(@Body() body: Record<string, unknown>) {
    return this.kyc.createCompany(
      body as {
        name?: string;
        company_id?: number;
        strategic?: boolean;
        sector?: string;
        industry?: string;
        city?: string;
        country?: string;
        website?: string;
        revenue?: string;
        employees?: string;
        tech_stack?: string;
        notes?: string;
        source?: string;
      },
    );
  }

  @Post('companies/bulk-delete')
  @HttpCode(200)
  bulkDelete(@Body() body: { ids: number[] }) {
    return this.kyc.bulkDeleteCompanyProfiles(body?.ids ?? []);
  }

  @Post('companies/import')
  importCo(@Body() body: { companies: Record<string, string>[] }) {
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
  async patchProfile(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.kyc.patchProfile(BigInt(id), body);
  }

  @Post('companies/:id/profile/synthesize-summary')
  @HttpCode(200)
  synthesizeSummary(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.kyc.synthesizeExecutiveSummary(BigInt(id), user.userId);
  }

  @Get('companies/:id/timeline')
  timeline(@Param('id') id: string) {
    return this.kyc.getTimeline(BigInt(id));
  }

  @Post('companies/:id/enrich')
  @HttpCode(501)
  enrich() {
    return this.kyc.enrichNotAvailable();
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
  @HttpCode(200)
  fetchNews(@Param('id') id: string) {
    return this.kyc.fetchNewsSignals(BigInt(id));
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
    @Body() body: { title?: string; type?: string },
  ) {
    return this.kyc.createChatSession(BigInt(id), user.userId, body ?? {});
  }

  @Get('chat/sessions/:sessionId/messages')
  msgs(@Param('sessionId') sessionId: string) {
    return this.kyc.getChatMessages(BigInt(sessionId));
  }

  @Post('chat/sessions/:sessionId/stream')
  async stream(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: UserPayload,
    @Body() body: { message?: string },
    @Res() res: Response,
  ) {
    return this.kyc.streamChat(BigInt(sessionId), user.userId, res, String(body?.message ?? ''));
  }
}
