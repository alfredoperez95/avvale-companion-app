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
    return this.buildTokenResponse(user.id, user.email);
  }

  async validateUserById(userId: string) {
    return this.usersService.findById(userId);
  }

  async updateProfile(
    userId: string,
    dto: { name?: string; lastName?: string; position?: string },
  ) {
    const user = await this.usersService.updateProfile(userId, dto);
    if (!user) return null;
    const { passwordHash: _, ...rest } = user;
    return rest;
  }

  private buildTokenResponse(userId: string, email: string) {
    const payload: JwtPayload = { sub: userId, email };
    const accessToken = this.jwtService.sign(payload);
    return { accessToken, user: { id: userId, email } };
  }
}
