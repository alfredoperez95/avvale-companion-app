import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import type { Response } from 'express';
import type { RequestWithId } from '../security/request-id.middleware';
import type { UserPayload } from '../auth/decorators/user-payload';
import { redactSensitive } from '../security/sensitive-redaction';
import { AuditActorType, AuditService } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<RequestWithId>();
    const res = context.switchToHttp().getResponse<Response>();
    const startedAt = Date.now();

    return next.handle().pipe(
      finalize(() => {
        const user = req.user as UserPayload | undefined;
        const path = req.path || req.url || '';
        const tokenHash = this.extractTokenHash(path, req.query);
        const sanitizedPath = sanitizeAuditPath(path);
        const moduleName = inferModule(sanitizedPath);
        const action = inferAction(req.method, sanitizedPath);
        const entity = inferEntity(sanitizedPath);
        const entityId = inferEntityId(path, tokenHash != null);
        const actorType = inferActorType(sanitizedPath, user);
        const route = typeof req.route?.path === 'string' ? req.route.path : undefined;

        void this.audit.record({
          actorUserId: user?.userId ?? null,
          actorEmail: user?.email ?? null,
          actorRole: user?.role ?? null,
          actorType,
          module: moduleName,
          action,
          entity,
          entityId,
          method: req.method,
          path: sanitizedPath,
          route,
          statusCode: res.statusCode,
          requestId: req.requestId ?? null,
          ip: req.ip,
          userAgent: headerValue(req.headers['user-agent'])?.slice(0, 512) ?? null,
          tokenHash,
          meta: {
            durationMs: Date.now() - startedAt,
            query: redactSensitive(req.query),
          },
        });
      }),
    );
  }

  private extractTokenHash(path: string, query: RequestWithId['query']): string | null {
    const parts = path.split('/').filter(Boolean);
    if (parts[0] === 'public' && parts[1] === 'attachments' && parts[2]) {
      return this.audit.hashToken(parts[2]);
    }
    if (parts[0] === 'public' && parts[1] === 'expense-exports' && parts[2]) {
      return this.audit.hashToken(parts[2]);
    }
    if (parts[0] === 'auth' && parts[1] === 'invitations' && parts[2] === 'preview') {
      const token = query?.token;
      return typeof token === 'string' && token ? this.audit.hashToken(token) : null;
    }
    return null;
  }
}

function inferActorType(path: string, user?: UserPayload): AuditActorType {
  if (user?.role === 'ADMIN') return 'admin';
  if (user) return 'user';
  if (path.startsWith('/webhooks/')) return 'webhook';
  if (path.startsWith('/health')) return 'system';
  if (path.startsWith('/extensions/')) return 'extension';
  return 'public';
}

function inferModule(path: string): string {
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'public' && parts[1] === 'expense-exports') return 'expenses';
  if (parts[0] === 'public' && parts[1] === 'attachments') return 'attachments';
  if (parts[0] === 'webhooks') return 'webhook';
  if (parts[0] === 'user' && parts[1] === 'ai-credentials') return 'ai-credentials';
  if (parts[0] === 'yubiq') return 'yubiq';
  return parts[0] || 'root';
}

function inferAction(method: string, path: string): string {
  if (path.includes('/login')) return 'login';
  if (path.includes('/magic-link/')) return 'magicLink';
  if (path.includes('/invitations/')) return 'invitation';
  if (path.startsWith('/webhooks/')) return 'webhook';
  if (path.startsWith('/health')) return 'health';
  if (path.startsWith('/public/') || path.includes('/file') || path.includes('/avatar') || path.includes('/extensions/')) {
    return method === 'GET' ? 'download' : methodAction(method);
  }
  if (path.includes('/upload') || path.includes('/sources') || path.includes('/attachments')) return 'upload';
  if (path.includes('/exports') || path.includes('/export')) return 'export';
  if (path.includes('/import')) return 'import';
  if (
    path.includes('/analyze') ||
    path.includes('/process') ||
    path.includes('/enrich') ||
    path.includes('/synthesize') ||
    path.includes('/translate') ||
    path.includes('/infer') ||
    path.includes('/chat/')
  ) {
    return 'ai';
  }
  return methodAction(method);
}

function methodAction(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'read';
    case 'POST':
      return 'create';
    case 'PATCH':
    case 'PUT':
      return 'update';
    case 'DELETE':
      return 'delete';
    default:
      return method.toLowerCase();
  }
}

function inferEntity(path: string): string | null {
  const parts = path.split('/').filter(Boolean);
  if (!parts.length) return null;
  if (parts[0] === 'webhooks') return parts.slice(1, 3).join('.') || 'webhook';
  if (parts[0] === 'public') return parts[1] ?? 'public';
  if (parts[0] === 'auth') return parts.slice(0, 2).join('.');
  return parts.slice(0, 2).join('.');
}

function inferEntityId(path: string, hasPublicToken: boolean): string | null {
  if (hasPublicToken) return null;
  const parts = path.split('/').filter(Boolean);
  const id = parts.find((part) => isUuid(part) || /^\d+$/.test(part));
  return id ?? null;
}

function sanitizeAuditPath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'public' && parts[1] === 'attachments') return '/public/attachments/:token';
  if (parts[0] === 'public' && parts[1] === 'expense-exports') {
    return `/public/expense-exports/:token/${parts[3] ? sanitizePathSegment(parts[3]) : ':fileName'}`;
  }
  return `/${parts.map(sanitizePathSegment).join('/')}`;
}

function sanitizePathSegment(segment: string): string {
  if (isUuid(segment)) return segment;
  if (/^[A-Za-z0-9_-]{24,}$/.test(segment)) return ':token';
  return segment.slice(0, 160);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
