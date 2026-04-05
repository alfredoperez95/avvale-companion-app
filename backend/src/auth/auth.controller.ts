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

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
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
  async verifyMagicLink(@Body() dto: MagicLinkVerifyDto) {
    return this.authService.verifyMagicLink(dto.token);
  }

  @Get('branding')
  getBranding() {
    return this.authService.getLoginBranding();
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() payload: UserPayload) {
    const user = await this.authService.validateUserById(payload.userId);
    if (!user) return null;
    const { passwordHash: _, ...rest } = user;
    return rest;
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
    const user = await this.authService.validateUserById(payload.userId);
    if (!user) return { avatarPath };
    const { passwordHash: _, ...rest } = user;
    return rest;
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
    const user = await this.authService.validateUserById(payload.userId);
    if (!user) return { avatarPath: null };
    const { passwordHash: _, ...rest } = user;
    return rest;
  }
}
