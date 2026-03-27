import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export interface JwtPayload {
  sub: string;
  email: string;
}

type Appearance = 'microsoft' | 'fiori';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.usersService.create(dto);
    return this.buildTokenResponse(user.id, user.email);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (user.enabled === false) {
      throw new UnauthorizedException('Usuario deshabilitado. Contacte al administrador.');
    }
    return this.buildTokenResponse(user.id, user.email);
  }

  async validateUserById(userId: string) {
    return this.usersService.findById(userId);
  }

  async updateProfile(
    userId: string,
    dto: { name?: string; lastName?: string; position?: string; phone?: string; appearance?: string | null },
  ) {
    const user = await this.usersService.updateProfile(userId, dto);
    if (!user) return null;
    const { passwordHash: _, ...rest } = user;
    return rest;
  }

  async setAvatar(userId: string, file: { buffer: Buffer; mimetype?: string }) {
    return this.usersService.setAvatar(userId, file);
  }

  async getAvatarBuffer(userId: string) {
    return this.usersService.getAvatarBuffer(userId);
  }

  async removeAvatar(userId: string) {
    return this.usersService.removeAvatar(userId);
  }

  getLoginBranding() {
    const rawAppearance = (process.env.LOGIN_APPEARANCE ?? process.env.DEFAULT_APPEARANCE ?? 'microsoft')
      .toLowerCase()
      .trim();
    const appearance: Appearance = rawAppearance === 'fiori' ? 'fiori' : 'microsoft';
    return { appearance };
  }

  private buildTokenResponse(userId: string, email: string) {
    const payload: JwtPayload = { sub: userId, email };
    const accessToken = this.jwtService.sign(payload);
    return { accessToken, user: { id: userId, email } };
  }
}
