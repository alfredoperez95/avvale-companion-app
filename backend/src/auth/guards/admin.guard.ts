import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserPayload } from '../decorators/user-payload';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as UserPayload | undefined;
    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenException('Acceso restringido a administradores');
    }
    return true;
  }
}
