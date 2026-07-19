import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { RequestWithId } from './request-id.middleware';
import { redactSensitive } from './sensitive-redaction';

const DEFAULT_ERROR_MESSAGES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'La solicitud no es válida',
  [HttpStatus.UNAUTHORIZED]: 'No autenticado',
  [HttpStatus.FORBIDDEN]: 'No autorizado',
  [HttpStatus.NOT_FOUND]: 'Recurso no encontrado',
  [HttpStatus.CONFLICT]: 'Conflicto con el estado actual del recurso',
  [HttpStatus.GONE]: 'Recurso no disponible',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Demasiadas solicitudes',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Error interno',
  [HttpStatus.BAD_GATEWAY]: 'Error de proveedor externo',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'Servicio no disponible',
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<RequestWithId>();
    const res = ctx.getResponse<Response>();
    const isProd = process.env.NODE_ENV === 'production';
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const errorName = exception instanceof HttpException ? exception.name : 'InternalServerError';

    this.logger.error(
      JSON.stringify(
        redactSensitive({
          requestId: req.requestId,
          method: req.method,
          path: req.path,
          statusCode,
          error: errorName,
          message: exception instanceof Error ? exception.message : String(exception),
        }),
      ),
    );

    res.status(statusCode).json({
      statusCode,
      error: httpStatusText(statusCode),
      message: safeMessage(exception, statusCode, isProd),
      requestId: req.requestId,
    });
  }
}

function safeMessage(exception: unknown, statusCode: number, isProd: boolean): string {
  if (isProd) return DEFAULT_ERROR_MESSAGES[statusCode] ?? 'La solicitud no se pudo procesar';

  if (exception instanceof HttpException) {
    const response = exception.getResponse();
    if (typeof response === 'string') return response;
    if (response && typeof response === 'object' && 'message' in response) {
      const message = (response as { message: unknown }).message;
      return Array.isArray(message) ? message.join('; ') : String(message);
    }
  }

  return exception instanceof Error ? exception.message : DEFAULT_ERROR_MESSAGES[statusCode] ?? 'Error';
}

function httpStatusText(statusCode: number): string {
  return DEFAULT_ERROR_MESSAGES[statusCode]?.replace(/^La solicitud /, '') ?? 'Error';
}
