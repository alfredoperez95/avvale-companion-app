import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import type { StringValue } from 'ms';
import * as multer from 'multer';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';
import { InvitationsModule } from '../invitations/invitations.module';

const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

@Module({
  imports: [
    UsersModule,
    MailModule,
    InvitationsModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET')?.trim();
        if (!secret) {
          throw new Error('JWT_SECRET debe estar definido');
        }
        return {
          secret,
          // Duración máxima de sesión (JWT). Formato: número+unidad (ej. 12h, 5d, 7d). Ver docs/LOGIN_STANDARD.md
          signOptions: {
            algorithm: 'HS256' as const,
            expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '5d') as StringValue,
            issuer: config.get<string>('JWT_ISSUER')?.trim() || 'avvale-companion-backend',
            audience: config.get<string>('JWT_AUDIENCE')?.trim() || 'avvale-companion',
          },
        };
      },
      inject: [ConfigService],
    }),
    MulterModule.register({
      storage: multer.memoryStorage(),
      limits: { fileSize: AVATAR_MAX_BYTES },
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
