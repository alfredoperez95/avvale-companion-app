import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Delete,
  UseGuards,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
  Query,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { MagicLinkRequestDto } from './dto/magic-link-request.dto';
import { MagicLinkVerifyDto } from './dto/magic-link-verify.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { UserPayload } from './decorators/user-payload';
import { InvitationsService } from '../invitations/invitations.service';
import { AcceptInvitationDto } from '../invitations/dto/accept-invitation.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly invitationsService: InvitationsService,
  ) {}

  @Post('register')
  @UseGuards(ThrottlerGuard)
  @Throttle({ 'auth-brute': { limit: 10, ttl: 60_000 } })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ 'auth-brute': { limit: 10, ttl: 60_000 } })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('magic-link/request')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ 'magic-link': { limit: 5, ttl: 60_000 } })
  async requestMagicLink(@Body() dto: MagicLinkRequestDto) {
    return this.authService.requestMagicLink(dto.email);
  }

  @Post('magic-link/verify')
  @UseGuards(ThrottlerGuard)
  @Throttle({ 'auth-brute': { limit: 15, ttl: 60_000 } })
  async verifyMagicLink(@Body() dto: MagicLinkVerifyDto) {
    return this.authService.verifyMagicLink(dto.token);
  }

  @Get('invitations/preview')
  async previewInvitation(@Query('token') token: string) {
    return this.invitationsService.getPreviewByToken(token ?? '');
  }

  @Post('invitations/accept')
  @UseGuards(ThrottlerGuard)
  @Throttle({ 'magic-link': { limit: 10, ttl: 60_000 } })
  async acceptInvitation(@Body() dto: AcceptInvitationDto) {
    const user = await this.invitationsService.acceptInvitation(dto);
    return this.authService.buildTokenResponse(user.id, user.email);
  }

  @Get('branding')
  getBranding() {
    return this.authService.getLoginBranding();
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() payload: UserPayload) {
    return this.authService.getUserPublicById(payload.userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@CurrentUser() payload: UserPayload, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(payload.userId, dto);
  }

  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @CurrentUser() payload: UserPayload,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file?.buffer) throw new BadRequestException('Falta el archivo');
    const { avatarPath } = await this.authService.setAvatar(payload.userId, {
      buffer: file.buffer,
      mimetype: file.mimetype,
    });
    const user = await this.authService.getUserPublicById(payload.userId);
    if (!user) return { avatarPath };
    return user;
  }

  @Get('me/avatar')
  @UseGuards(JwtAuthGuard)
  async getAvatar(@CurrentUser() payload: UserPayload, @Res() res: Response) {
    const result = await this.authService.getAvatarBuffer(payload.userId);
    if (!result) {
      res.status(404).send();
      return;
    }
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Content-Type', result.contentType);
    res.send(result.buffer);
  }

  @Delete('me/avatar')
  @UseGuards(JwtAuthGuard)
  async deleteAvatar(@CurrentUser() payload: UserPayload) {
    await this.authService.removeAvatar(payload.userId);
    const user = await this.authService.getUserPublicById(payload.userId);
    if (!user) return { avatarPath: null };
    return user;
  }
}
