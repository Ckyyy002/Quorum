import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { STATUS_CODES } from 'node:http';

export interface ErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
}

/** Turns every thrown error into the one error shape the API promises. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const body = this.toBody(exception, req.originalUrl);
    if (body.statusCode >= 500) this.logger.error(exception);
    res.status(body.statusCode).json(body);
  }

  toBody(exception: unknown, path: string): ErrorBody {
    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const fallbackError = STATUS_CODES[statusCode] ?? 'Error';

    let message: string | string[] = 'Internal server error';
    let error = fallbackError;
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        message = response;
      } else {
        // Nest exceptions (and ValidationPipe, whose message is string[]) return { message, error }.
        const r = response as { message?: string | string[]; error?: string };
        message = r.message ?? exception.message;
        error = r.error ?? fallbackError;
      }
    }

    // Unknown errors never leak their internal message to the client.
    return { statusCode, message, error, path, timestamp: new Date().toISOString() };
  }
}
